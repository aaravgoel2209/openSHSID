"""数据迁移：为已存在的文章自动翻译（检测语言并翻成另一种语言），缓存译文。

best-effort：模型服务（localhost:5000）不在线时整体跳过；单条失败不影响其它行，
迁移本身永远不会因翻译失败而报错。模型服务在 start.bat 中先于 migrate 启动。
"""
from django.db import migrations


def translate_existing(apps, schema_editor):
    import logging
    logger = logging.getLogger(__name__)
    from OpenSHSID_backend.translation import service_available, build_translation

    if not service_available():
        logger.warning("[Migrate] 模型服务离线，跳过文章自动翻译（之后发布会自动补译）")
        return

    Article = apps.get_model("knowledge", "Article")
    pending = Article.objects.filter(title_translated="", content_translated="")
    total = pending.count()
    if not total:
        return
    logger.info("[Migrate] 开始翻译 %s 篇已有文章…", total)
    done = 0
    for a in pending.iterator():
        try:
            src, title_t, content_t = build_translation(a.title, a.content, a.source_lang or None)
            a.source_lang = src
            a.title_translated = (title_t or "")[:400]
            a.content_translated = content_t or ""
            a.save(update_fields=["source_lang", "title_translated", "content_translated"])
            done += 1
        except Exception as e:  # noqa: BLE001
            logger.error("[Migrate] 翻译文章 #%s 失败: %s", a.pk, e)
    logger.info("[Migrate] 文章翻译完成 %s/%s", done, total)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("knowledge", "0009_article_content_translated_article_source_lang_and_more"),
    ]

    operations = [
        migrations.RunPython(translate_existing, noop_reverse),
    ]
