import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserLayout from './layouts/UserLayout';
import HomePage from './pages/user/HomePage';
import CatalogPage from './pages/user/CatalogPage';
import BookDetailPage from './pages/user/BookDetailPage';
import MyBooksPage from './pages/user/MyBooksPage';
const PdfReaderPage = lazy(() => import('./pages/user/PdfReaderPage'));
import RoomBookingPage from './pages/user/RoomBookingPage';
import WalletTopUpPage from './pages/user/WalletTopUpPage';
import Login from './pages/auth/Login';
import NotFoundPage from './pages/NotFoundPage';
import UiKitPage from './pages/dev/UiKitPage';

// Admin Portal
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import CatalogManagement from './pages/admin/CatalogManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import LoanManagement from './pages/admin/LoanManagement';
import FineManagement from './pages/admin/FineManagement';
import EbookManagement from './pages/admin/EbookManagement';
import IncidentPage from './pages/admin/IncidentPage';

import AdminGuard from './components/AdminGuard';

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
          <Route path="rooms" element={<RoomBookingPage />} />
          <Route path="wallet/top-up" element={<WalletTopUpPage />} />
        </Route>

        {/* Trình đọc Sách PDF toàn màn hình */}
        <Route path="/reader/:loanId" element={<Suspense fallback={<p className="p-12 text-center">Đang mở trình đọc…</p>}><PdfReaderPage /></Suspense>} />
        <Route path="/books/:bookId/preview" element={<Suspense fallback={<p className="p-12 text-center">Đang mở bản xem trước…</p>}><PdfReaderPage /></Suspense>} />

        {/* Trang kiểm thử Component Dev UI-Kit */}
        {import.meta.env.DEV && (
          <Route path="/dev/ui-kit" element={<UiKitPage />} />
        )}

        {/* Cổng Quản trị Admin Portal (Đã được bảo vệ bởi AdminGuard) */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="catalog" element={<CatalogManagement />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="inventory/:bookId" element={<InventoryManagement />} />
          <Route path="books" element={<InventoryManagement />} />
          <Route path="books/:bookId" element={<InventoryManagement />} />
          <Route path="ebooks" element={<EbookManagement />} />
          <Route path="loans" element={<LoanManagement />} />
          <Route path="fines" element={<FineManagement />} />
          <Route path="incidents" element={<IncidentPage />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
