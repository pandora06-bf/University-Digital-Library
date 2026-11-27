import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserLayout from './layouts/UserLayout';
import HomePage from './pages/user/HomePage';
import CatalogPage from './pages/user/CatalogPage';
import BookDetailPage from './pages/user/BookDetailPage';
import MyBooksPage from './pages/user/MyBooksPage';
const PdfReaderPage = lazy(() => import('./pages/user/PdfReaderPage'));
import RoomBookingPage from './pages/user/RoomBookingPage';
import WalletTopUpPage from './pages/user/WalletTopUpPage';
import AccountPage from './pages/user/AccountPage';
import LoginPage from './pages/auth/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';
import UiKitPage from './pages/dev/UiKitPage';
import { SHOW_UI_KIT } from './utils/featureFlags';

// Admin Portal
import AdminLayout from './layouts/AdminLayout';
import CatalogManagement from './pages/admin/CatalogManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import LoanManagement from './pages/admin/LoanManagement';
import FineManagement from './pages/admin/FineManagement';
import EbookManagement from './pages/admin/EbookManagement';
import IncidentPage from './pages/admin/IncidentPage';
import UserManagement from './pages/admin/UserManagement';
import RoomManagement from './pages/admin/RoomManagement';
import RoomCheckin from './pages/admin/RoomCheckin';
import UnmatchedTxPage from './pages/admin/UnmatchedTxPage';

import AdminRoute from './components/AdminRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route Đăng nhập */}
        <Route path="/login" element={<LoginPage />} />

        {/* Cổng Độc giả User Portal với Layout chung */}
        <Route path="/" element={<UserLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="books/:bookId" element={<BookDetailPage />} />
          {/* 2B-13: trang cá nhân cần đăng nhập; khách vẫn xem trang chủ, danh mục, chi tiết sách */}
          <Route element={<ProtectedRoute />}>
            <Route path="my-books" element={<MyBooksPage />} />
            <Route path="rooms" element={<RoomBookingPage />} />
            <Route path="wallet/top-up" element={<WalletTopUpPage />} />
            {/* 4-13: Thông tin người dùng + Tài khoản dịch vụ */}
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Route>

        {/* Trình đọc Sách PDF toàn màn hình */}
        <Route path="/reader/:loanId" element={<ProtectedRoute><Suspense fallback={<p className="p-12 text-center">Đang mở trình đọc…</p>}><PdfReaderPage /></Suspense></ProtectedRoute>} />
        <Route path="/books/:bookId/preview" element={<Suspense fallback={<p className="p-12 text-center">Đang mở bản xem trước…</p>}><PdfReaderPage /></Suspense>} />

        {/* Trang kiểm thử Component Dev UI-Kit — chỉ khi VITE_SHOW_UI_KIT=true */}
        {SHOW_UI_KIT && (
          <Route path="/dev/ui-kit" element={<UiKitPage />} />
        )}

        {/* Cổng Quản trị Admin Portal (2B-17: AdminRoute chặn non-ADMIN) */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="catalog" replace />} />
          <Route path="catalog" element={<CatalogManagement />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="inventory/:bookId" element={<InventoryManagement />} />
          <Route path="books" element={<InventoryManagement />} />
          <Route path="books/:bookId" element={<InventoryManagement />} />
          <Route path="ebooks" element={<EbookManagement />} />
          <Route path="loans" element={<LoanManagement />} />
          <Route path="fines" element={<FineManagement />} />
          <Route path="incidents" element={<IncidentPage />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="rooms" element={<RoomManagement />} />
          <Route path="rooms/checkin" element={<RoomCheckin />} />
          <Route path="unmatched" element={<UnmatchedTxPage />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
