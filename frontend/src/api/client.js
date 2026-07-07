import axios from 'axios';
import { API_BASE } from '../config';

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default client;
