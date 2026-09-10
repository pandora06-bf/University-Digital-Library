import React, { useState } from 'react';
import { BookOpen, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // Trạng thái ẩn/hiện mật khẩu

    const handleSubmit = (e) => {
        e.preventDefault();

        // Tự động phân quyền dựa trên dữ liệu nhập
        let detectedRole = 'user';
        if (email.toLowerCase().includes('admin')) {
            detectedRole = 'admin';
        }

        if (onLogin) {
            onLogin({ email, role: detectedRole });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-2xl text-indigo-600 mb-3">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">LibManager</h1>
                    <p className="text-slate-500 text-sm mt-1">Hệ thống Quản lý Thư viện Số</p>
                </div>

                {/* Form Đăng nhập */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email / Username */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                            Tên đăng nhập / Email
                        </label>
                        <div className="relative">
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email hoặc tên đăng nhập"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                            />
                            {/* Nút Bật/Tắt xem mật khẩu */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                        <span>Đăng nhập hệ thống</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                {/* Chú thích gợi ý test */}
                <div className="mt-6 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-center space-y-1">
                    <p className="font-medium text-slate-600 mb-1">💡 Mẹo thử nghiệm nhanh:</p>
                    <p>Nhập email chứa từ <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-600 font-semibold">admin</code> → Vào Cổng Admin</p>
                    <p>Nhập email bất kỳ khác → Vào Cổng Độc giả</p>
                </div>

            </div>
        </div>
    );
}