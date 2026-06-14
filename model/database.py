"""
本地 SQLite 数据库 — 标题 + 内容 + 对话历史
"""
import sqlite3
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
            content TEXT NOT NULL
        )
    ''')
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
