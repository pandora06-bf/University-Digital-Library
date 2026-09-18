import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserLayout from './layouts/UserLayout';
import HomePage from './pages/user/HomePage';
import CatalogPage from './pages/user/CatalogPage';
import BookDetailPage from './pages/user/BookDetailPage';
import MyBooksPage from './pages/user/MyBooksPage';
import PdfReaderPage from './pages/user/PdfReaderPage';
import Login from './pages/auth/Login';
import NotFoundPage from './pages/NotFoundPage';
import UiKitPage from './pages/dev/UiKitPage';

// Admin Portal
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import CatalogManagement from './pages/admin/CatalogManagement';
import BookManagement from './pages/admin/BookManagement';
import LoanManagement from './pages/admin/LoanManagement';
import FineManagement from './pages/admin/FineManagement';
import EbookManagement from './pages/admin/EbookManagement';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route Đăng nhập */}
        <Route path="/login" element={<Login />} />

        {/* Cổng Độc giả User Portal với Layout chung */}
        <Route path="/" element={<UserLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="books/:bookId" element={<BookDetailPage />} />
          <Route path="my-books" element={<MyBooksPage />} />
        </Route>

        {/* Trình đọc Sách PDF toàn màn hình */}
        <Route path="/reader/:loanId" element={<PdfReaderPage />} />

        {/* Trang kiểm thử Component Dev UI-Kit */}
        {import.meta.env.DEV && (
          <Route path="/dev/ui-kit" element={<UiKitPage />} />
        )}

        {/* Cổng Quản trị Admin Portal */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="catalog" element={<CatalogManagement />} />
          <Route path="books" element={<BookManagement />} />
          <Route path="ebooks" element={<EbookManagement />} />
          <Route path="loans" element={<LoanManagement />} />
          <Route path="fines" element={<FineManagement />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}