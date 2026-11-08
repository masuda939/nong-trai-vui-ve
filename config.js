// ============================================================
// CẤU HÌNH SUPABASE
// Điền URL và anon key của dự án Supabase của bạn vào đây.
// Anon key là khoá công khai (public), an toàn khi đặt ở client.
// Có thể ghi đè bằng biến môi trường Vercel khi build (xem README).
// ============================================================
window.SUPABASE_CONFIG = {
  url: window.__SUPABASE_URL__ || "https://fewonehaokbylpemznug.supabase.co",
  anonKey: window.__SUPABASE_ANON_KEY__ || "sb_publishable_N7dXhsSlhWsa15z9s3k8AA_2JGBryqs",
};
