import client from './client';

export const login = (username, password) =>
  client.post('/auth/login/', { username, password }).then((r) => r.data);

export const register = (username, password) =>
  client.post('/auth/register/', { username, password }).then((r) => r.data);

export const getProfile = () =>
  client.get('/auth/profile/').then((r) => r.data);
