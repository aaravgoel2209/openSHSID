"""
清空当前数据库并重建表结构（migrate）。

用途：远程 MySQL 同时承担测试与部署，切换环境前需要彻底清数据。
- MySQL 模式：DROP 当前库中全部表（临时关闭外键检查），再 migrate 重建；
- SQLite 模式：删除 db 文件（含 -wal/-shm），再 migrate 重建。

用法：
    python manage.py reset_db            # 交互确认后执行
    python manage.py reset_db --yes      # 跳过确认（脚本/CI）
    python manage.py reset_db --yes --no-migrate   # 只清数据，不重建
"""
from django.conf import settings
from django.core.management import call_command, BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = '清空当前数据库全部数据（删表/删文件）并重新执行 migrate'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='跳过确认提示')
        parser.add_argument('--no-migrate', action='store_true', help='只清数据，不执行 migrate')

    def handle(self, *args, **opts):
        engine = settings.DATABASES['default']['ENGINE']
        vendor = 'mysql' if 'mysql' in engine else ('sqlite' if 'sqlite' in engine else engine)
        if vendor not in ('mysql', 'sqlite'):
            raise CommandError(f'reset_db 不支持当前数据库引擎: {engine}')

        if not opts['yes']:
            answer = input(
                f'即将清空 {vendor} 数据库中的全部数据（不可恢复），输入 yes 继续: ')
            if answer.strip().lower() != 'yes':
                raise CommandError('已取消')

        if vendor == 'mysql':
            self._reset_mysql()
        else:
            self._reset_sqlite()

        if opts['no_migrate']:
            self.stdout.write(self.style.SUCCESS('数据已清空（未执行 migrate）。'))
        else:
            self.stdout.write('重新执行 migrate …')
            call_command('migrate', interactive=False)
            self.stdout.write(self.style.SUCCESS('数据库已重建完成。'))

    def _reset_mysql(self):
        connection.close()
        with connection.cursor() as cur:
            cur.execute('SELECT table_name FROM information_schema.tables '
                        'WHERE table_schema = DATABASE()')
            tables = [row[0] for row in cur.fetchall()]
            if not tables:
                self.stdout.write('数据库为空，无需清理。')
                return
            self.stdout.write(f'删除 {len(tables)} 张表: {", ".join(tables)}')
            cur.execute('SET FOREIGN_KEY_CHECKS=0')
            for t in tables:
                cur.execute(f'DROP TABLE IF EXISTS `{t}`')
            cur.execute('SET FOREIGN_KEY_CHECKS=1')

    def _reset_sqlite(self):
        from pathlib import Path
        connection.close()
        path = Path(settings.DATABASES['default']['NAME'])
        for suffix in ('', '-wal', '-shm'):
            f = Path(str(path) + suffix)
            if f.exists():
                f.unlink()
                self.stdout.write(f'已删除 {f}')
