import client from './client';

export const getLabels = () =>
  client.get('/qa/labels/').then((r) => r.data);
