# 🌱 Nông Trại Vui Vẻ

Game nông trại 2D lấy cảm hứng từ **Stardew Valley** — chạy hoàn toàn trên web (HTML/CSS/JS thuần, không cần build).

## ✨ Tính năng

- 🧑‍🌾 Điều khiển nhân vật (WASD/mũi tên), cuốc đất, gieo hạt, tưới nước, thu hoạch
- 🌱 5 loại cây mở khóa theo cấp độ: Củ cải → Khoai tây → Ngô → Cà chua (mọc lại) → Bí ngô
- 📅 Chu kỳ ngày: cây chỉ lớn lên nếu được tưới nước; ngủ để sang ngày mới và hồi năng lượng
- 🏪 Cửa hàng mua hạt giống, túi đồ bán nông sản
- ⭐ Hệ thống XP / Level với thưởng mở khóa cây mới
- 🔊 Hiệu ứng âm thanh WebAudio, đồ họa pixel-art vẽ bằng Canvas

## 💾 Lưu tiến trình (Supabase)

- Người chơi **tạo tài khoản / đăng nhập bằng email + mật khẩu** (Supabase Auth)
- Tiến trình (vàng, cấp độ, ngày, ruộng, túi đồ) lưu trong bảng `farm_saves` — đăng nhập lại là chơi tiếp từ chỗ cũ
- RLS (Row Level Security) đảm bảo mỗi user chỉ đọc/ghi save của chính mình
- Chế độ **khách** lưu tạm bằng `localStorage`

## 🚀 Chạy cục bộ

```bash
# Chỉ cần mở index.html bằng một server tĩnh, ví dụ:
npx serve .
# hoặc
python -m http.server 8000
```

## ⚙️ Cấu hình Supabase

1. Tạo dự án tại [supabase.com](https://supabase.com)
2. Chạy nội dung file `supabase-setup.sql` trong **SQL Editor**
3. Vào **Settings → API**, copy `Project URL` và `anon public key`
4. Điền vào `config.js` (hoặc dùng biến môi trường Vercel, xem bên dưới)

> Nên vào **Authentication → Providers → Email** và tắt "Confirm email" để người chơi vào game ngay sau khi đăng ký.

## ☁️ Triển khai lên Vercel

1. Push repo này lên GitHub
2. Tạo project mới trên [vercel.com](https://vercel.com) và import repo (framework: **Other** — site tĩnh)
3. Thêm Environment Variables (tùy chọn — để tự sinh `config.js` lúc build):

| Biến | Giá trị |
|---|---|
| `SUPABASE_URL` | Project URL của Supabase |
| `SUPABASE_ANON_KEY` | anon public key |

4. Thêm **Build Command** trong Vercel:
   `node -e "const fs=require('fs');fs.writeFileSync('config.js',\"window.__SUPABASE_URL__='\"+process.env.SUPABASE_URL+\"';window.__SUPABASE_ANON_KEY__='\"+process.env.SUPABASE_ANON_KEY+';')"`
   (hoặc giữ trống nếu đã điền key trực tiếp trong `config.js`)

Sau khi deploy, mở link `*.vercel.app`, tạo tài khoản và chơi — tiến trình tự động lưu theo tài khoản!

## 🎮 Điều khiển

| Phím | Chức năng |
|---|---|
| `WASD` / mũi tên | Di chuyển |
| `Space` / `E` | Dùng công cụ (cuốc / tưới / gieo / thu hoạch) |
| `1`–`6` | Chọn vật phẩm |
| `B` | Cửa hàng |
| `Q` | Túi đồ |
| `Enter` | Ngủ qua đêm (đứng cạnh nhà) |
| `Ctrl+S` | Lưu thủ công |
