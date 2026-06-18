import random

from django.db.models.signals import post_save
from django.db.backends.signals import connection_created
from django.dispatch import receiver
from django.contrib.auth.models import User
from qa.models import Question, Answer
from knowledge.models import Article
from accounts.models import UserProfile


@receiver(connection_created)
def _set_sqlite_pragmas(sender, connection, **kwargs):
    """SQLite 并发优化：WAL 允许读写并发，busy_timeout 让请求在锁上等待而非直接 500。
    缓解 Rei 流式回答高频写入与轮询读取并发导致的 'database is locked'。"""
    if connection.vendor == 'sqlite':
        cursor = connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA synchronous=NORMAL;')
        cursor.execute('PRAGMA busy_timeout=20000;')


def _init_emb(instance, field='embedding'):
    if getattr(instance, field) is None:
        setattr(instance, field, [round(random.uniform(-1, 1), 6) for _ in range(32)])
        instance.save(update_fields=[field])


@receiver(post_save, sender=Question)
def init_question_emb(sender, instance, created, **kwargs):
    if created:
        _init_emb(instance)


@receiver(post_save, sender=Article)
def init_article_emb(sender, instance, created, **kwargs):
    if created:
        _init_emb(instance)


@receiver(post_save, sender=User)
def init_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
