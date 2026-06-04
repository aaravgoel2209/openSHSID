import client from './client';

export const getQuestions = (search) =>
  client.get('/qa/questions/', { params: search ? { search } : {} }).then((r) => r.data);

export const getQuestion = (id) =>
  client.get(`/qa/questions/${id}/`).then((r) => r.data);

export const createQuestion = (title, content) =>
  client.post('/qa/questions/', { title, content }).then((r) => r.data);

export const getAnswers = (questionId) =>
  client.get(`/qa/questions/${questionId}/answers/`).then((r) => r.data);

export const createAnswer = (questionId, content) =>
  client.post(`/qa/questions/${questionId}/answers/`, { content }).then((r) => r.data);

export const toggleQuestionLike = (id) =>
  client.post(`/qa/questions/${id}/like/`).then((r) => r.data);

export const toggleAnswerLike = (id) =>
  client.post(`/qa/answers/${id}/like/`).then((r) => r.data);
