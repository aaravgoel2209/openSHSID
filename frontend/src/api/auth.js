import client from './client';

export const login = (username, password) =>
  client.post('/auth/login/', { username, password }).then((r) => r.data);

export const register = (username, password) =>
  client.post('/auth/register/', { username, password }).then((r) => r.data);

export const getProfile = () =>
  client.get('/auth/profile/').then((r) => r.data);

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('avatar', file);
  return client.post('/auth/avatar/upload/', form).then((r) => r.data);
};
