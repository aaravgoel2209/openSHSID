import random

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from qa.models import Question, Answer
from knowledge.models import Article
from accounts.models import UserProfile


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
