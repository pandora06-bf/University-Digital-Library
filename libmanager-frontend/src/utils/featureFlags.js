// Cờ bật công cụ dành cho lập trình viên. Container web chạy `npm run dev` nên không dựa vào
// import.meta.env.DEV; mặc định giao diện sạch, chỉ bật khi đặt VITE_SHOW_UI_KIT=true.
export const SHOW_UI_KIT = import.meta.env.VITE_SHOW_UI_KIT === 'true';
