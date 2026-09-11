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
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
            {/* Lớp màu trang trí nền (Mesh Gradient) */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-300/30 rounded-full mix-blend-multiply filter blur-[80px] opacity-70"></div>
            <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-cyan-300/30 rounded-full mix-blend-multiply filter blur-[80px] opacity-70"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-[80px] opacity-70"></div>

            {/* Khung Đăng nhập */}
            <div className="max-w-md w-full bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_40px_rgb(0,0,0,0.08)] border border-white p-8 relative z-10">

                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl text-white shadow-lg mb-3">
                        <BookOpen className="w-9 h-9" strokeWidth={2.5} />
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
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                            <input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email hoặc tên đăng nhập"
                                className="w-full pl-10 pr-4 py-3 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:bg-white/80 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-10 py-3 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:bg-white/80 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                            />
                            {/* Nút Bật/Tắt xem mật khẩu */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg hover:shadow-cyan-500/30 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                    >
                        <span>Đăng nhập</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                {/* Chú thích gợi ý test */}
                <div className="mt-6 p-4 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 text-xs text-slate-700 text-center space-y-1.5 shadow-sm">
                    <p className="font-semibold text-slate-800 mb-1">💡 Mẹo thử nghiệm nhanh:</p>
                    <p>Nhập email chứa từ <code className="bg-white/60 px-1.5 py-0.5 rounded text-blue-700 font-bold">admin</code> → Vào Cổng Admin</p>
                    <p>Nhập email bất kỳ khác → Vào Cổng Độc giả</p>
                </div>

            </div>
        </div>
    );
}