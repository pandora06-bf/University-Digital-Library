import axios from 'axios';

const TOKEN_KEY = 'libmanager_token';

// Helper đọc/ghi token (chỉ sửa ở đây nếu muốn đổi nơi lưu)
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
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
      // Token hết hạn hoặc sai: xóa token, quay về đăng nhập
      setToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
