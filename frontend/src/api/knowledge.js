import client from './client';

export const getGrades = () =>
  client.get('/knowledge/grades/').then((r) => r.data);

export const getSubjects = () =>
  client.get('/knowledge/subjects/').then((r) => r.data);

export const getArticles = (grade, subject) => {
  const params = {};
  if (grade) params.grade = grade;
  if (subject) params.subject = subject;
  return client.get('/knowledge/articles/', { params }).then((r) => r.data);
};

export const getArticle = (id) =>
  client.get(`/knowledge/articles/${id}/`).then((r) => r.data);

export const createArticle = (data) =>
  client.post('/knowledge/articles/', data).then((r) => r.data);

export const toggleArticleLike = (id) =>
  client.post(`/knowledge/articles/${id}/like/`).then((r) => r.data);
