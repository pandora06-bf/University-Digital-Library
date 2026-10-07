import axiosInstance, { setToken } from './axios_instance';
import { setCurrentUser } from '../mocks/auth';

// Chuyển user từ backend sang dạng các trang frontend đang dùng
function toFrontendUser(apiUser) {
  return {
    id: apiUser.id,
    name: apiUser.username,
    username: apiUser.username,
    role: apiUser.role.toUpperCase() === 'ADMIN' ? 'admin' : 'user',
    apiRole: apiUser.role, // giữ vai trò gốc: STUDENT / LECTURER / ADMIN
  };
}

export async function login(username, password) {
  const { data } = await axiosInstance.post('/api/auth/login', { username, password });
  setToken(data.access_token); // interceptor sẽ tự đọc token này
  const user = toFrontendUser(data.user);
  setCurrentUser(user);
  return user;
}

export function logout() {
  setToken(null);
  setCurrentUser(null);
}

export async function getMe() {
  const { data } = await axiosInstance.get('/api/auth/me'); // không cần tự gắn header!
  return data;
}
