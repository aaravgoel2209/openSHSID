import client from './client';

export const getConversations = () =>
  client.get('/chat/conversations/').then((r) => r.data);

export const getMessages = (userId) =>
  client.get('/chat/messages/', { params: { user: userId } }).then((r) => r.data);

export const sendMessage = (recipient, content) =>
  client.post('/chat/messages/', { recipient, content }).then((r) => r.data);

export const searchUsers = (q) =>
  client.get('/chat/users/', { params: { q } }).then((r) => r.data);
