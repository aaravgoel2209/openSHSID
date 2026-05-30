import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8000/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default client;
