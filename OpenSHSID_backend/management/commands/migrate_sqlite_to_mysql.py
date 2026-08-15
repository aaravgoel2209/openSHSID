"""
把本地 SQLite（默认 db.sqlite3）的数据整体迁移到当前 MySQL 库。

原理：Django 官方 dumpdata → loaddata 通道，并处理 SQLite → MySQL 的两个经典坑：
1. ContentType / Permission 的 id 对不上 —— 用 --natural-foreign --natural-primary，
   按 (app_label, model) / (codename, app_label.model) 自然键解析到目标库
   migrate 时已由 post_migrate 生成的内容类型与权限；
2. 显式 id 导入后 AUTO_INCREMENT 不回卷 —— 导入完成后执行 sqlsequencereset 重置自增。

注意：
- auth.User / Group / Permission 等带自然键的模型按自然键导入，
  用户 id 可能与源库不同（所有引用均通过自然键解析，不影响一致性）；
- 其余模型（问答/文章/聊天/通知/帖子等）保留源库 id；
- django_admin_log、django_session 等运行期杂项不迁移。

用法：
    python manage.py migrate_sqlite_to_mysql --reset --yes
    # --reset：先清空目标 MySQL（reset_db）再导入；目标库已有数据时必须加
    # --yes ：跳过确认
"""
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command, BaseCommand, CommandError
from django.db import connection

# 不迁移的 app / model（运行期杂项；权限与内容类型由 post_migrate 在目标库重建）
EXCLUDES = ['contenttypes', 'admin.logentry', 'sessions']


class Command(BaseCommand):
    help = '将本地 SQLite 数据迁移到当前 MySQL 库（dumpdata → loaddata）'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='先清空目标 MySQL（reset_db）再导入')
        parser.add_argument('--yes', action='store_true', help='跳过确认提示')

    def handle(self, *args, **opts):
        engine = settings.DATABASES['default']['ENGINE']
        if 'mysql' not in engine:
            raise CommandError(
                '当前数据库不是 MySQL。请先把 config.json 的 django.database.type 切到 "mysql" 再运行。')

        from OpenSHSID_backend.config_loader import cfg
        sqlite_path = Path(settings.BASE_DIR) / cfg['django']['database']['name']
        if not sqlite_path.exists():
            raise CommandError(
                f'找不到 SQLite 源库: {sqlite_path}（把待迁移的 db.sqlite3 放到项目根目录，'
                f'或修改 config.json django.database.name）')

        if not opts['reset'] and self._target_has_data():
            raise CommandError(
                '目标 MySQL 已有业务数据。首次迁移请加 --reset 先清空目标库，避免重复/冲突。')

        if opts['reset'] and not opts['yes']:
            answer = input('将先清空目标 MySQL 再导入（不可恢复），输入 yes 继续: ')
            if answer.strip().lower() != 'yes':
                raise CommandError('已取消')

        if opts['reset']:
            self.stdout.write('0/3 清空目标 MySQL …')
            call_command('reset_db', yes=True)

        fixture = None
        try:
            self.stdout.write('1/3 从 SQLite 导出 …')
            fixture = self._dump()
            self.stdout.write('2/3 导入 MySQL …')
            self._load(fixture)
            self.stdout.write('3/3 重置自增序列 …')
            self._reset_sequences()
        finally:
            if fixture:
                os.unlink(fixture)

        self.stdout.write(self.style.SUCCESS('迁移完成。'))

    # ── 1. 导出：独立子进程以 DB_TYPE=sqlite 跑 dumpdata ──────────────────────
    def _dump(self):
        fd, tmp = tempfile.mkstemp(suffix='.json', prefix='sqlite2mysql_')
        os.close(fd)
        env = dict(os.environ)
        env['DB_TYPE'] = 'sqlite'
        # Windows 下 open() 默认按 locale 编码（GBK）写文件，loaddata 按 UTF-8 读会崩；
        # 强制子进程走 UTF-8 模式，保证临时 fixture 是 UTF-8。
        env.setdefault('PYTHONUTF8', '1')
        env.setdefault('PYTHONIOENCODING', 'utf-8')
        args = [sys.executable, str(Path(settings.BASE_DIR) / 'manage.py'), 'dumpdata',
                '--natural-foreign', '--natural-primary', '--output', tmp]
        for e in EXCLUDES:
            args += ['--exclude', e]
        result = subprocess.run(args, cwd=str(settings.BASE_DIR), env=env,
                                capture_output=True, text=True)
        if result.returncode != 0:
            os.unlink(tmp)
            raise CommandError(f'dumpdata 失败:\n{(result.stderr or result.stdout).strip()}')
        if result.stderr:
            self.stderr.write(result.stderr.strip())
        try:
            with open(tmp, encoding='utf-8') as f:
                count = len(json.load(f))
        except Exception:
            count = 0
        self.stdout.write(f'   导出 {count} 条对象')
        return tmp

    # ── 2. 导入：关闭外键检查后 loaddata（顺序无关），完毕恢复 ────────────────
    def _load(self, fixture):
        with connection.cursor() as cur:
            cur.execute('SET FOREIGN_KEY_CHECKS=0')
        try:
            buf = io.StringIO()
            call_command('loaddata', fixture, verbosity=1, stdout=buf)
            msg = buf.getvalue().strip()
            self.stdout.write(f'   {msg}' if msg else '   （源库无数据，跳过）')
        finally:
            with connection.cursor() as cur:
                cur.execute('SET FOREIGN_KEY_CHECKS=1')

    # ── 3. 重置 AUTO_INCREMENT（否则后续插入会撞已导入的显式 id）──────────────
    # 注意：Django 的 sqlsequencereset 仅对 PostgreSQL 有实现（MySQL 上是空操作），
    # 这里直接按 information_schema 找出所有自增列，把计数器拨到 MAX(id)+1。
    def _reset_sequences(self):
        with connection.cursor() as cur:
            cur.execute(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND extra LIKE '%auto_increment%'")
            columns = cur.fetchall()
            for table, column in columns:
                cur.execute(f"SELECT COALESCE(MAX(`{column}`), 0) + 1 FROM `{table}`")
                nxt = cur.fetchone()[0]
                cur.execute(f"ALTER TABLE `{table}` AUTO_INCREMENT = %s", [nxt])
        self.stdout.write(f'   已重置 {len(columns)} 张表的自增序列')

    # ── 辅助：目标库是否已有业务数据（排除迁移记录表）────────────────────────
    def _target_has_data(self):
        with connection.cursor() as cur:
            cur.execute('SELECT table_name FROM information_schema.tables '
                        "WHERE table_schema = DATABASE()")
            tables = [r[0] for r in cur.fetchall() if r[0] != 'django_migrations']
            for t in tables:
                cur.execute(f'SELECT COUNT(*) FROM `{t}`')
                if cur.fetchone()[0] > 0:
                    return True
        return False
