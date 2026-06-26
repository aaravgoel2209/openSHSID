import client from './client';

export const getCourses = () => client.get('/crawler/courses/').then(r => r.data);
export const getCourse = (courseId) => client.get(`/crawler/courses/${courseId}/`).then(r => r.data);
export const getCredentials = () => client.get('/crawler/credentials/').then(r => r.data);
export const saveCredentials = (username, password) =>
  client.post('/crawler/credentials/', { username, password }).then(r => r.data);
export const deleteCredentials = () => client.delete('/crawler/credentials/');
export const syncCourses = (courseIds) =>
  client.post('/crawler/sync/', courseIds ? { course_ids: courseIds } : {}).then(r => r.data);
export const clearSessionCache = () => client.post('/crawler/clear-cache/').then(r => r.data);
export const getBrowserLoginHtml = () =>
  client.get('/crawler/browser-login/', { responseType: 'text' }).then(r => r.data);
export const downloadResourceUrl = (url) =>
  `/api/crawler/download/?url=${encodeURIComponent(url)}`;
