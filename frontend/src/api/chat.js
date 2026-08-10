import client from './client';

export const getConversations = () =>
  client.get('/chat/conversations/').then((r) => r.data);

export const getMessages = (userId) =>
  client.get('/chat/messages/', { params: { user: userId } }).then((r) => r.data);

export const sendMessage = (recipient, content) =>
  client.post('/chat/messages/', { recipient, content }).then((r) => r.data);

// 打开会话时调用：把对方发来的未读消息全部标记为已读（同时清空对应私信通知）
export const markConversationRead = (userId) =>
  client.post(`/chat/conversations/${userId}/read/`).then((r) => r.data);

export const searchUsers = (q) =>
  client.get('/chat/users/', { params: { q } }).then((r) => r.data);
