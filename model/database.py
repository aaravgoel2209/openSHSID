"""
本地 SQLite 数据库 — 标题 + 内容（含 RAG 向量）+ 对话历史
"""
import sqlite3
import json
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / 'data' / 'local.db'


def get_conn():
    Path(__file__).parent.joinpath('data').mkdir(exist_ok=True)
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
    # 外部内容向量缓存（从 Django 同步，用于 RAG 检索）：source = 'kb' | 'qa' ...
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ext_chunks (
            source TEXT NOT NULL,
            ext_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT,
            content_hash TEXT,
            PRIMARY KEY (source, ext_id)
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
    """加载某来源的全部缓存，embedding 解析为 list（无则为 None）"""
    conn = get_conn()
    rows = conn.execute(
        'SELECT ext_id, title, content, embedding FROM ext_chunks WHERE source=?', (source,)
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
        out.append({'id': r['ext_id'], 'title': r['title'], 'content': r['content'], 'embedding': emb})
    return out


def get_chunk_hashes(source):
    """返回 {ext_id: content_hash}，用于增量同步判断哪些条目变了"""
    conn = get_conn()
    rows = conn.execute('SELECT ext_id, content_hash FROM ext_chunks WHERE source=?', (source,)).fetchall()
    conn.close()
    return {r['ext_id']: r['content_hash'] for r in rows}


def upsert_chunk(source, ext_id, title, content, embedding, content_hash):
    conn = get_conn()
    conn.execute(
        '''INSERT INTO ext_chunks (source, ext_id, title, content, embedding, content_hash)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(source, ext_id) DO UPDATE SET
               title=excluded.title, content=excluded.content,
               embedding=excluded.embedding, content_hash=excluded.content_hash''',
        (source, ext_id, title, content, json.dumps(embedding), content_hash)
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
