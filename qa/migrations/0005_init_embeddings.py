import random

from django.db import migrations


def init_question_embeddings(apps, schema_editor):
    Question = apps.get_model('qa', 'Question')
    for q in Question.objects.filter(embedding__isnull=True):
        q.embedding = [round(random.uniform(-1, 1), 6) for _ in range(32)]
        q.save(update_fields=['embedding'])


class Migration(migrations.Migration):

    dependencies = [
        ('qa', '0004_question_embedding'),
    ]

    operations = [
        migrations.RunPython(init_question_embeddings, reverse_code=migrations.RunPython.noop),
    ]
