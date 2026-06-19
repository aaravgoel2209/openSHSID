"""监听系统事件，自动写入信箱通知。

事件来源：
- 有人回答了你的问题 / 回复了你的回答（含 Rei 的回复）
- 有人点赞了你的问题 / 回答 / 文章
"""
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.contrib.auth.models import User

from qa.models import Question, Answer
from knowledge.models import Article
from chat.models import Message
from .models import Notification


def _notify(recipient, actor, ntype, title, message='', link=''):
    """创建一条通知；接收者为空或自己触发自己时跳过。"""
    if recipient is None:
        return
    if actor is not None and actor.id == recipient.id:
        return
    Notification.objects.create(
        recipient=recipient, actor=actor, type=ntype,
        title=title, message=(message or '')[:200], link=link,
    )


# ── 回答 / 回复 ────────────────────────────────────────────

@receiver(post_save, sender=Answer)
def on_answer_created(sender, instance, created, **kwargs):
    if not created:
        return
    answer = instance
    actor = answer.author
    who = actor.username if actor else '有人'
    snippet = answer.content or ''
    link = f'/qa/questions/{answer.question_id}'

    if answer.parent_id and answer.parent.author:
        # 回复了某条回答 → 通知该回答作者（Rei 回复会落到这里）
        _notify(answer.parent.author, actor, 'reply',
                f'{who} 回复了你', snippet, link)
    else:
        # 对问题的顶层回答 → 通知提问者
        _notify(answer.question.author, actor, 'answer',
                f'{who} 回答了你的问题', snippet, link)


# ── 点赞 ──────────────────────────────────────────────────

def _notify_likes(instance, pk_set, ntype, title_tpl, link):
    author = getattr(instance, 'author', None)
    if author is None or not pk_set:
        return
    for actor in User.objects.filter(id__in=pk_set):
        if actor.id == author.id:
            continue
        _notify(author, actor, ntype, title_tpl.format(who=actor.username), link=link)


@receiver(m2m_changed, sender=Question.likes.through)
def on_question_like(sender, instance, action, pk_set, **kwargs):
    if action == 'post_add':
        _notify_likes(instance, pk_set, 'like', '{who} 赞了你的问题',
                      f'/qa/questions/{instance.id}')


@receiver(m2m_changed, sender=Answer.likes.through)
def on_answer_like(sender, instance, action, pk_set, **kwargs):
    if action == 'post_add':
        _notify_likes(instance, pk_set, 'like', '{who} 赞了你的回答',
                      f'/qa/questions/{instance.question_id}')


@receiver(m2m_changed, sender=Article.likes.through)
def on_article_like(sender, instance, action, pk_set, **kwargs):
    if action == 'post_add':
        _notify_likes(instance, pk_set, 'like', '{who} 赞了你的文章',
                      f'/knowledge/{instance.id}')


# ── 私信 ──────────────────────────────────────────────────

@receiver(post_save, sender=Message)
def on_message_created(sender, instance, created, **kwargs):
    if not created:
        return
    msg = instance
    who = msg.sender.username if msg.sender else '有人'
    _notify(msg.recipient, msg.sender, 'message',
            f'{who} 给你发了私信', msg.content, f'/chat/{msg.sender_id}')
