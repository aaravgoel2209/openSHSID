from django.test import TestCase
from django.contrib.auth.models import User

from .models import Subbar, Post, PostComment


class PostbarModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='pw')
        self.subbar = Subbar.objects.create(name='测试吧', description='用于测试', created_by=self.user)

    def test_post_and_comment_counts(self):
        post = Post.objects.create(subbar=self.subbar, title='第一帖', content='内容', author=self.user)
        self.assertEqual(self.subbar.posts.count(), 1)
        PostComment.objects.create(post=post, content='沙发', author=self.user)
        self.assertEqual(post.comments.count(), 1)

    def test_post_like_toggle(self):
        post = Post.objects.create(subbar=self.subbar, title='帖', content='c', author=self.user)
        post.likes.add(self.user)
        self.assertEqual(post.likes.count(), 1)
