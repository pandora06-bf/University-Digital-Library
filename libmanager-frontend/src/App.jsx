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

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}