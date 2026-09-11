import React, { useState } from 'react';
import { BookOpen, Lock, Mail, Eye, EyeOff, LogIn, Lightbulb } from 'lucide-react';
import loginBg from '../../assets/login-bg.png';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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
        <div
            className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-cover bg-center bg-no-repeat relative overflow-hidden select-none"
            style={{ backgroundImage: `url(${loginBg})` }}
        >
            {/* Khung Đăng nhập */}
            <div className="max-w-[430px] w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_rgba(37,99,235,0.12)] border border-white/90 p-8 sm:p-9 relative z-10 transition-all">

                {/* Logo & Header */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-b from-[#2d8eff] to-[#155dfc] rounded-[20px] text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)] mb-4">
                        <BookOpen className="w-8 h-8" strokeWidth={2.3} />
                    </div>
                    <h1 className="text-[26px] font-bold text-[#1a56db] tracking-tight">LibManager</h1>
                    <p className="text-slate-500 text-sm mt-1 font-normal">Hệ thống Quản lý Thư viện Số</p>
                </div>

                {/* Form Đăng nhập */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Tên đăng nhập / Email */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            TÊN ĐĂNG NHẬP / EMAIL
                        </label>
                        <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email hoặc tên đăng nhập"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/90 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            MẬT KHẨU
                        </label>
                        <div className="relative">
                            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Nhập mật khẩu"
                                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200/90 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                            {/* Nút Bật/Tắt xem mật khẩu */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-500/80 hover:text-blue-600 transition-colors p-1"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Nút Đăng nhập */}
                    <button
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-[#29b6f6] to-[#1e62ec] hover:from-[#0288d1] hover:to-[#1a56db] text-white font-semibold rounded-xl text-sm shadow-[0_8px_20px_rgba(30,98,236,0.3)] hover:shadow-[0_10px_25px_rgba(30,98,236,0.4)] flex items-center justify-center gap-2 mt-5 cursor-pointer transition-all active:scale-[0.99]"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Đăng nhập</span>
                    </button>
                </form>

                {/* Chú thích gợi ý test */}
                <div className="mt-6 p-4 bg-sky-50/40 rounded-2xl border border-sky-100/70 text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Mẹo thử nghiệm nhanh:</span>
                    </div>
                    <div className="pl-5 space-y-1 text-slate-500">
                        <p>
                            Nhập email chứa từ <code className="bg-blue-100/70 text-blue-700 font-semibold px-1.5 py-0.5 rounded">admin</code> → Vào Cổng Admin
                        </p>
                        <p>Nhập email bất kỳ khác → Vào Cổng Độc giả</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
