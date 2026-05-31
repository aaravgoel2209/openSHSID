import random

from django.db import migrations


def init_user_embeddings(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserProfile = apps.get_model('accounts', 'UserProfile')
    for u in User.objects.all():
        up, created = UserProfile.objects.get_or_create(user=u)
        if up.embedding is None:
            up.embedding = [round(random.uniform(-1, 1), 6) for _ in range(32)]
            up.save(update_fields=['embedding'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(init_user_embeddings, reverse_code=migrations.RunPython.noop),
    ]
