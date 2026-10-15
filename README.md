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
