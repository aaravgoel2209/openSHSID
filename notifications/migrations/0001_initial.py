import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('answer', '回答'), ('reply', '回复'), ('like', '点赞'), ('message', '私信'), ('system', '系统')], default='system', max_length=20, verbose_name='类型')),
                ('title', models.CharField(max_length=200, verbose_name='标题')),
                ('message', models.TextField(blank=True, verbose_name='内容')),
                ('link', models.CharField(blank=True, max_length=300, verbose_name='跳转链接')),
                ('is_read', models.BooleanField(default=False, verbose_name='已读')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='时间')),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='触发者')),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL, verbose_name='接收者')),
            ],
            options={
                'verbose_name': '通知',
                'verbose_name_plural': '通知',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read'], name='notificatio_recipie_3d4f8e_idx'),
        ),
    ]
