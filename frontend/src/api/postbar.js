import client from './client';

// 子吧 Subbar
export const getSubbars = (search) =>
  client.get('/postbar/subbars/', { params: search ? { search } : {} }).then((r) => r.data);

export const getSubbar = (id) =>
  client.get(`/postbar/subbars/${id}/`).then((r) => r.data);

export const createSubbar = (name, description) =>
  client.post('/postbar/subbars/', { name, description }).then((r) => r.data);

// 吧务团队 Team
export const getSubbarTeam = (id) =>
  client.get(`/postbar/subbars/${id}/managers/`).then((r) => r.data);

export const addManager = (id, username) =>
  client.post(`/postbar/subbars/${id}/managers/`, { username }).then((r) => r.data);

export const removeManager = (id, userId) =>
  client.delete(`/postbar/subbars/${id}/managers/`, { data: { user_id: userId } }).then((r) => r.data);

// 帖子 Post
export const getSubbarPosts = (subbarId) =>
  client.get(`/postbar/subbars/${subbarId}/posts/`).then((r) => r.data);

export const createPost = (subbarId, title, content) =>
  client.post(`/postbar/subbars/${subbarId}/posts/`, { title, content }).then((r) => r.data);

export const getPost = (id) =>
  client.get(`/postbar/posts/${id}/`).then((r) => r.data);

export const deletePost = (id) =>
  client.delete(`/postbar/posts/${id}/`).then((r) => r.data);

export const viewPost = (id) =>
  client.post(`/postbar/posts/${id}/view/`).then((r) => r.data);

export const togglePostLike = (id) =>
  client.post(`/postbar/posts/${id}/like/`).then((r) => r.data);

// 回复 Comment
export const createComment = (postId, content, parent) =>
  client.post(`/postbar/posts/${postId}/comments/`, { content, parent }).then((r) => r.data);

export const deleteComment = (postId, commentId) =>
  client.delete(`/postbar/posts/${postId}/comments/`, { data: { comment_id: commentId } }).then((r) => r.data);

export const toggleCommentLike = (id) =>
  client.post(`/postbar/comments/${id}/like/`).then((r) => r.data);
