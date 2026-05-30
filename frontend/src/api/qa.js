import client from './client';

export const getQuestions = () =>
  client.get('/qa/questions/').then((r) => r.data);

export const getQuestion = (id) =>
  client.get(`/qa/questions/${id}/`).then((r) => r.data);

export const createQuestion = (title, content) =>
  client.post('/qa/questions/', { title, content }).then((r) => r.data);

export const getAnswers = (questionId) =>
  client.get(`/qa/questions/${questionId}/answers/`).then((r) => r.data);

export const createAnswer = (questionId, content) =>
  client.post(`/qa/questions/${questionId}/answers/`, { content }).then((r) => r.data);
