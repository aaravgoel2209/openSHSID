import random

from django.db import migrations


def init_article_embeddings(apps, schema_editor):
    Article = apps.get_model('knowledge', 'Article')
    for a in Article.objects.filter(embedding__isnull=True):
        a.embedding = [round(random.uniform(-1, 1), 6) for _ in range(32)]
        a.save(update_fields=['embedding'])


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge', '0004_article_embedding'),
    ]

    operations = [
        migrations.RunPython(init_article_embeddings, reverse_code=migrations.RunPython.noop),
    ]
