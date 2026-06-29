"""按需把尚未翻译（或翻译失败留空）的问题/文章补译并缓存。

用法：
    python manage.py retranslate            # 翻译所有缺译文的问题和文章
    python manage.py retranslate --force    # 重新翻译全部（覆盖已有译文）
    python manage.py retranslate --only qa  # 仅问题；--only knowledge 仅文章

依赖本地模型服务（localhost:5000 的 /translate）。数据迁移在模型服务离线时会跳过，
此命令可在服务就绪后手动补译。
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from OpenSHSID_backend.translation import service_available, build_translation


class Command(BaseCommand):
    help = "为缺少译文的问题/文章自动翻译并缓存"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="重新翻译全部，覆盖已有译文")
        parser.add_argument("--only", choices=["qa", "knowledge"], help="仅处理某一类内容")

    def handle(self, *args, **opts):
        if not service_available():
            self.stderr.write(self.style.ERROR("模型服务离线 (localhost:5000)，无法翻译。"))
            return

        from qa.models import Question
        from knowledge.models import Article

        targets = []
        if opts["only"] in (None, "qa"):
            targets.append(("问题", Question))
        if opts["only"] in (None, "knowledge"):
            targets.append(("文章", Article))

        for label, Model in targets:
            qs = Model.objects.all()
            if not opts["force"]:
                qs = qs.filter(Q(title_translated="") & Q(content_translated=""))
            total = qs.count()
            self.stdout.write(f"[{label}] 待翻译 {total} 条…")
            done = 0
            for obj in qs.iterator():
                try:
                    src, title_t, content_t = build_translation(
                        obj.title, obj.content, obj.source_lang or None)
                    obj.source_lang = src
                    obj.title_translated = (title_t or "")[:400]
                    obj.content_translated = content_t or ""
                    obj.save(update_fields=["source_lang", "title_translated", "content_translated"])
                    done += 1
                except Exception as e:  # noqa: BLE001
                    self.stderr.write(self.style.WARNING(f"  #{obj.pk} 失败: {e}"))
            self.stdout.write(self.style.SUCCESS(f"[{label}] 完成 {done}/{total}"))
