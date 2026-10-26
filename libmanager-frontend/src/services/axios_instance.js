import axios from 'axios';
import { setCurrentUser } from '../mocks/auth';

const TOKEN_KEY = 'libmanager_token';

// Token lưu localStorage theo 2B-13 (giữ đăng nhập khi mở lại tab).
// Bọc try/catch: trình duyệt chặn bộ nhớ (chế độ riêng tư) thì coi như chưa đăng nhập.
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* bộ nhớ bị chặn: bỏ qua */ }
};

// 1. Tạo instance: mọi request dùng chung baseURL
// Mặc định 8010 — tránh đụng cổng 8000 (web khác trên máy). Docker/.env cũng dùng 8010.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8010',
  timeout: 10000,
});

// 2. Request interceptor: chạy TRƯỚC mỗi request, đính token vào header
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Response interceptor: chạy SAU mỗi response
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      // Token hết hạn hoặc sai: xóa token và user, quay về đăng nhập (giữ trang đang mở để quay lại)
      setToken(null);
      setCurrentUser(null);
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(from)}`;
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
