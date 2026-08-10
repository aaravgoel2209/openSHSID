import client from './client';

export const getGrades = () =>
  client.get('/knowledge/grades/').then((r) => r.data);

export const getSubjects = () =>
  client.get('/knowledge/subjects/').then((r) => r.data);

export const getArticles = (grade, subject, search) => {
  const params = {};
  if (grade) params.grade = grade;
  if (subject) params.subject = subject;
  if (search) params.search = search;
  return client.get('/knowledge/articles/', { params }).then((r) => r.data);
};

export const getArticle = (id) =>
  client.get(`/knowledge/articles/${id}/`).then((r) => r.data);

// 顶部搜索栏实时建议：标题匹配，返回 [{id, title, type: 'article'|'question', meta}]
export const searchTitles = (q) =>
  client.get('/knowledge/search-titles/', { params: { q } }).then((r) => r.data);

export const createArticle = (data) =>
  client.post('/knowledge/articles/', data).then((r) => r.data);

export const toggleArticleLike = (id) =>
  client.post(`/knowledge/articles/${id}/like/`).then((r) => r.data);

export const createComment = (articleId, content, parent = null) =>
  client.post(`/knowledge/articles/${articleId}/comments/`, { content, parent }).then((r) => r.data);

export const toggleCommentLike = (commentId) =>
  client.post(`/knowledge/comments/${commentId}/like/`).then((r) => r.data);

export const deleteComment = (articleId, commentId) =>
  client.delete(`/knowledge/articles/${articleId}/comments/`, { data: { comment_id: commentId } }).then((r) => r.data);
