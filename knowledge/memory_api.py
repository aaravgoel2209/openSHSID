import sqlite3
from pathlib import Path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAdminUser])
def memory_list(request):
    db_path = Path(__file__).parent.parent / 'model' / 'data' / 'local.db'
    if not db_path.exists():
        return Response({'items': []})
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT id, title, content FROM items ORDER BY id DESC').fetchall()
    conn.close()
    return Response({'items': [dict(r) for r in rows]})
