"""
本地 SQLite 数据库 — 标题 + 内容（含 RAG 向量）+ 对话历史
"""
import sqlite3
import json
import time

from config_loader import cfg, ROOT

# 路径集中在 config.json 的 database 段
DB_PATH = ROOT / cfg['database']['path']


def get_conn():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT
        )
    ''')
    # 兼容旧库：缺 embedding 列时补加
    cols = [r[1] for r in conn.execute('PRAGMA table_info(items)').fetchall()]
    if 'embedding' not in cols:
        conn.execute('ALTER TABLE items ADD COLUMN embedding TEXT')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at REAL NOT NULL
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id, created_at)')
    # 滚动摘要：被 token 预算挤出上下文的旧消息，折叠进这里，避免早期对话“凭空消失”。
    # last_id = 已并入摘要的最大 chat_history.id，下次只需增量折叠更新的溢出消息。
    conn.execute('''
        CREATE TABLE IF NOT EXISTS session_summaries (
            session_id TEXT PRIMARY KEY,
            summary TEXT NOT NULL,
            last_id INTEGER NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL
        )
    ''')
    # 外部内容向量缓存（从 Django 同步，用于 RAG 检索）：source = 'kb' | 'qa' ...
    # 长文按段切块，一条内容可对应多行（chunk_idx 递增）
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ext_chunks (
            source TEXT NOT NULL,
            ext_id INTEGER NOT NULL,
            chunk_idx INTEGER NOT NULL DEFAULT 0,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT,
            content_hash TEXT,
            PRIMARY KEY (source, ext_id, chunk_idx)
        )
    ''')
    # 旧版一条内容一行的缓存表缺 chunk_idx 列：直接重建（纯缓存，重新同步即可）
    cols = [r[1] for r in conn.execute('PRAGMA table_info(ext_chunks)').fetchall()]
    if 'chunk_idx' not in cols:
        conn.execute('DROP TABLE ext_chunks')
        conn.execute('''
            CREATE TABLE ext_chunks (
                source TEXT NOT NULL,
                ext_id INTEGER NOT NULL,
                chunk_idx INTEGER NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding TEXT,
                content_hash TEXT,
                PRIMARY KEY (source, ext_id, chunk_idx)
            )
        ''')
    # 清理旧版单一知识库缓存表（已被 ext_chunks 取代）
    conn.execute('DROP TABLE IF EXISTS kb_chunks')
    conn.commit()
    return conn


def save_message(session_id, role, content):
    conn = get_conn()
    conn.execute(
        'INSERT INTO chat_history (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
        (session_id, role, content, time.time())
    )
    conn.commit()
    conn.close()


def load_recent_messages(session_id, limit=20):
    conn = get_conn()
    rows = conn.execute(
        'SELECT role, content FROM chat_history WHERE session_id=? ORDER BY created_at ASC',
        (session_id,)
    ).fetchall()
    conn.close()
    return [{'role': r['role'], 'content': r['content']} for r in rows[-limit:]]


def load_messages_after(session_id, after_id=0, limit=500):
    """按 id 升序加载 id>after_id 的消息（带 id，供上下文预算/摘要用）。
    limit 只做兜底，防止异常长会话把内存撑爆——正常情况下预算会先把它们截掉。"""
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, role, content FROM chat_history WHERE session_id=? AND id>? ORDER BY id ASC',
        (session_id, after_id)
    ).fetchall()
    conn.close()
    rows = rows[-limit:]
    return [{'id': r['id'], 'role': r['role'], 'content': r['content']} for r in rows]


def count_session(session_id):
    """返回 (消息条数, 内容总字符数)，用于 100k 压缩的廉价预检（不加载正文）。"""
    conn = get_conn()
    row = conn.execute(
        'SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(content)), 0) AS s '
        'FROM chat_history WHERE session_id=?', (session_id,)
    ).fetchone()
    conn.close()
    return row['c'], row['s']


def load_all_messages(session_id):
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, role, content FROM chat_history WHERE session_id=? ORDER BY id ASC',
        (session_id,)
    ).fetchall()
    conn.close()
    return [{'id': r['id'], 'role': r['role'], 'content': r['content']} for r in rows]


def delete_messages_upto(session_id, max_id):
    """物理删除 id<=max_id 的原始消息（100k 压缩后清理已折叠进摘要的旧消息）。"""
    conn = get_conn()
    conn.execute('DELETE FROM chat_history WHERE session_id=? AND id<=?', (session_id, max_id))
    conn.commit()
    conn.close()


# ── 会话滚动摘要 ─────────────────────────────────────────

def get_session_summary(session_id):
    """返回 (summary, last_id)；无记录时 ('', 0)。"""
    conn = get_conn()
    row = conn.execute(
        'SELECT summary, last_id FROM session_summaries WHERE session_id=?', (session_id,)
    ).fetchone()
    conn.close()
    return (row['summary'], row['last_id']) if row else ('', 0)


def save_session_summary(session_id, summary, last_id):
    conn = get_conn()
    conn.execute(
        '''INSERT INTO session_summaries (session_id, summary, last_id, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
               summary=excluded.summary, last_id=excluded.last_id, updated_at=excluded.updated_at''',
        (session_id, summary, last_id, time.time())
    )
    conn.commit()
    conn.close()


# ── RAG 记忆向量 ──────────────────────────────────────────

def load_items_with_embeddings():
    """加载全部记忆条目，embedding 解析为 list（无则为 None）"""
    conn = get_conn()
    rows = conn.execute('SELECT id, title, content, embedding FROM items').fetchall()
    conn.close()
    out = []
    for r in rows:
        emb = None
        if r['embedding']:
            try:
                emb = json.loads(r['embedding'])
            except (ValueError, TypeError):
                emb = None
        out.append({'id': r['id'], 'title': r['title'], 'content': r['content'], 'embedding': emb})
    return out


def save_item_embedding(item_id, embedding):
    conn = get_conn()
    conn.execute('UPDATE items SET embedding=? WHERE id=?', (json.dumps(embedding), item_id))
    conn.commit()
    conn.close()


# ── 外部内容向量缓存（知识库 / 问答 …）────────────────────

def load_chunks(source):
    """加载某来源的全部缓存块，embedding 解析为 list（无则为 None）"""
    conn = get_conn()
    rows = conn.execute(
        'SELECT ext_id, chunk_idx, title, content, embedding FROM ext_chunks WHERE source=?', (source,)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        emb = None
        if r['embedding']:
            try:
                emb = json.loads(r['embedding'])
            except (ValueError, TypeError):
                emb = None
        out.append({'id': r['ext_id'], 'chunk_idx': r['chunk_idx'],
                    'title': r['title'], 'content': r['content'], 'embedding': emb})
    return out


def get_chunk_hashes(source):
    """返回 {ext_id: content_hash}，用于增量同步判断哪些条目变了"""
    conn = get_conn()
    rows = conn.execute(
        'SELECT DISTINCT ext_id, content_hash FROM ext_chunks WHERE source=?', (source,)
    ).fetchall()
    conn.close()
    return {r['ext_id']: r['content_hash'] for r in rows}


def replace_item_chunks(source, ext_id, title, chunks, content_hash):
    """整体替换某条内容的全部分块。chunks = [(chunk_text, embedding_list), ...]"""
    conn = get_conn()
    conn.execute('DELETE FROM ext_chunks WHERE source=? AND ext_id=?', (source, ext_id))
    conn.executemany(
        '''INSERT INTO ext_chunks (source, ext_id, chunk_idx, title, content, embedding, content_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        [(source, ext_id, i, title, text, json.dumps(emb), content_hash)
         for i, (text, emb) in enumerate(chunks)]
    )
    conn.commit()
    conn.close()


def delete_chunks_not_in(source, ext_ids):
    """删除某来源中已不存在的缓存（条目被删除时清理）"""
    conn = get_conn()
    if ext_ids:
        placeholders = ','.join('?' * len(ext_ids))
        conn.execute(
            f'DELETE FROM ext_chunks WHERE source=? AND ext_id NOT IN ({placeholders})',
            [source, *ext_ids]
        )
    else:
        conn.execute('DELETE FROM ext_chunks WHERE source=?', (source,))
    conn.commit()
    conn.close()
