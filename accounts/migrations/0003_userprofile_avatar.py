from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_init_embeddings'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='avatar',
            field=models.FileField(blank=True, null=True, upload_to='avatars/', verbose_name='头像'),
        ),
    ]
