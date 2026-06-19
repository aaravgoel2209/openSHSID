import client from './client';

export const getNotifications = () =>
  client.get('/notifications/').then((r) => r.data);

export const getUnreadCount = () =>
  client.get('/notifications/unread-count/').then((r) => r.data.count);

export const markNotificationRead = (id) =>
  client.post(`/notifications/${id}/read/`).then((r) => r.data);

export const markAllNotificationsRead = () =>
  client.post('/notifications/read-all/').then((r) => r.data);

export const clearNotifications = () =>
  client.delete('/notifications/clear/').then((r) => r.data);
