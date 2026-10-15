# Tin Video Studio

Web app dựng video tin tức dọc 9:16 từ văn bản. Video dựng trên trình duyệt người dùng, server chỉ giữ key và làm proxy.

- Đặc tả: `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`
- Lộ trình: `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`

## Chạy local (không cần key thật)

1. `npm install`
2. Tạo tài khoản:
   ```bash
   npm run user:entry -- hai "Hải" <mật-khẩu-ít-nhất-8-ký-tự>
   ```
   Chép dòng JSON in ra vào file `users.local.json` dạng mảng `[ {...}, {...} ]` (tối đa 5 dòng). File này không commit.
3. Đóng gói:
   ```bash
   npm run user:encode -- users.local.json
   ```
4. Tạo `.env.local` theo `.env.example`: `FAKE_PROVIDERS=1`, `APP_USERS=<chuỗi base64 vừa in>`, `AUTH_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>`.
5. `npm run dev` rồi mở http://localhost:3100

## Chạy với key thật

Bỏ `FAKE_PROVIDERS`, điền `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.

## Giọng clone MiniMax (tuỳ chọn)

1. Thu âm giọng đọc tin khoảng 1 phút (mp3/m4a/wav, 10 giây – 5 phút, ≤ 20 MB), phòng yên tĩnh. Chỉ dùng giọng của mình hoặc của người đã đồng ý.
2. Thêm `MINIMAX_API_KEY` vào `.env.local`.
3. Clone:
   ```bash
   npm run minimax:clone -- giong-hai.mp3 tvsHai001 Hai
   ```
   Script in link nghe thử và một dòng JSON.
4. Thêm dòng đó vào `MINIMAX_VOICES` (mảng JSON) trong `.env.local` và trên Vercel. Giọng hiện trong app với tên `vi-VN-MiniMax-Hai`, đứng đầu danh sách.
5. MiniMax xoá giọng clone nếu 7 ngày không dùng: tạo giọng thật trong app ít nhất một lần sau khi clone.

Có cấu hình MiniMax thì giọng clone dùng được cả khi `FAKE_PROVIDERS=1` (giọng Google lúc đó là giọng giả).

## API (đều cần đăng nhập, trừ đăng nhập)

| Route | Việc |
|---|---|
| `POST /api/auth/login` | `{ username, password }` → cookie phiên |
| `POST /api/auth/logout` | xoá cookie |
| `GET /api/tts/voices` | danh sách giọng `vi-VN` |
| `POST /api/tts` | `{ text, voiceName, speakingRate }` → âm thanh |
| `GET /api/stock/search?q=&kind=image\|video&page=&perPage=` | cảnh trám gộp Pexels + Pixabay |

## Kiểm tra

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
