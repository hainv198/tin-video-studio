# Tin Video Studio

Web app dựng video tin tức dọc 9:16 từ văn bản. Video dựng trên trình duyệt người dùng, server chỉ giữ key và làm proxy.

- Đặc tả: `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`
- Lộ trình: `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`

## Chạy local (không cần key thật)

1. `npm install`
2. Tạo tài khoản:
   ```bash
   npm run user:entry -- hai "Hải" <mật-khẩu-ít-nhất-8-ký-tự> admin
   ```
   Tham số cuối là role, tuỳ chọn: `admin` (xem và sửa màn Cấu hình/key) hoặc `user` (chỉ dựng video). Bỏ trống = `user`. Cần ít nhất một tài khoản `admin` để vào màn Cấu hình; tài khoản cũ không có trường `role` vẫn chạy bình thường nhưng là `user`. Đổi role: thêm/sửa `"role"` trong `users.local.json`, đóng gói lại `APP_USERS` rồi khởi động lại (role được tra mỗi lần, không cần đăng nhập lại).
   Chép dòng JSON in ra vào file `users.local.json` dạng mảng `[ {...}, {...} ]` (tối đa 5 dòng). File này không commit.
3. Đóng gói:
   ```bash
   npm run user:encode -- users.local.json
   ```
4. Tạo `.env.local` theo `.env.example`: `FAKE_PROVIDERS=1`, `APP_USERS=<chuỗi base64 vừa in>`, `AUTH_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>`.
5. `npm run dev` rồi mở http://localhost:3100
6. Quản lý tài khoản về sau: đăng nhập bằng tài khoản `admin`, vào **Tài khoản** (`/tai-khoan`, liên kết ở đầu trang studio và trang Cấu hình) để thêm tài khoản, đổi mật khẩu (có nút tạo mật khẩu ngẫu nhiên, chỉ hiện một lần), đổi role hoặc xoá. Màn này ghi `APP_USERS` vào `.env.local` và có hiệu lực ngay, không cần chạy lại `user:entry`/`user:encode`. Luật: tối đa 5 tài khoản, luôn còn ít nhất một `admin`, admin không tự xoá hay tự hạ role của mình. Hai lệnh dòng lệnh vẫn dùng được để tạo tài khoản đầu tiên.

## Chạy với key thật

Bỏ `FAKE_PROVIDERS`, điền ít nhất một nguồn cảnh trám (`PIXABAY_API_KEY` và/hoặc `PEXELS_API_KEY`; Pexels đang tạm ngừng cấp key mới) và ít nhất một nguồn giọng: `GOOGLE_TTS_API_KEY` (Google Cloud, cần thẻ) hoặc `GEMINI_API_KEY` (AI Studio, không cần thẻ) hoặc MiniMax. Có nhiều nguồn thì danh sách giọng gộp lại: vclip, MiniMax, Gemini, rồi Google.

## Giọng vclip.io (tuỳ chọn)

1. Đăng nhập https://tts.vclip.io rồi lấy API key tại https://tts.vclip.io/docs/api-keys.
2. Lấy voice ID của giọng clone trong mục "Giọng nói của bạn".
3. Thêm vào `.env.local` (và biến môi trường trên Vercel):
   ```
   VCLIP_API_KEY=<key>
   VCLIP_VOICES=[{"alias":"Hai","voiceId":"<voice ID>","gender":"MALE"}]
   ```
   Alias chỉ gồm chữ và số không dấu.
4. Khởi động lại app: giọng hiện với tên `vi-VN-Vclip-Hai`, đứng đầu danh sách (trước MiniMax, Gemini, Google). Tốc độ đọc hỗ trợ 0,5–2.

Thiếu một trong hai biến thì app chỉ ghi cảnh báo vào log và chạy như không có vclip. Nếu `VCLIP_VOICES` sai định dạng thì kiểm tra khởi động (`check-env`) báo lỗi và dừng; còn app đang chạy chỉ ghi cảnh báo và bỏ qua vclip. Mỗi lần tạo giọng vclip chạy bất đồng bộ (gửi, chờ xong rồi tải), tối đa khoảng 2 phút chờ + thời gian từng yêu cầu.

## Giọng clone MiniMax (tuỳ chọn)

1. Thu âm giọng đọc tin khoảng 1 phút (mp3/m4a/wav, 10 giây – 5 phút, ≤ 20 MB), phòng yên tĩnh. Chỉ dùng giọng của mình hoặc của người đã đồng ý.
2. Thêm `MINIMAX_API_KEY` vào `.env.local`.
3. Clone:
   ```bash
   npm run minimax:clone -- giong-hai.mp3 tvsHai001 Hai MALE
   ```
   Alias chỉ gồm chữ và số không dấu. Script in link nghe thử và một dòng JSON.
4. Thêm dòng đó vào `MINIMAX_VOICES` (mảng JSON) trong `.env.local` và trên Vercel. Giọng hiện trong app với tên `vi-VN-MiniMax-Hai`, đứng đầu danh sách.
5. MiniMax xoá giọng clone nếu 7 ngày không dùng: tạo giọng thật trong app ít nhất một lần sau khi clone.

Thiếu một trong hai biến hoặc `MINIMAX_VOICES` sai định dạng thì app chỉ ghi cảnh báo vào log và chạy như không có MiniMax.

Có cấu hình MiniMax thì giọng clone dùng được cả khi `FAKE_PROVIDERS=1` (giọng Google lúc đó là giọng giả).

## Giọng Gemini (AI Studio, tuỳ chọn)

1. Vào https://aistudio.google.com, đăng nhập tài khoản Google, tạo API key (không cần thẻ).
2. Dán vào `.env.local` (và biến môi trường trên Vercel) dòng `GEMINI_API_KEY=<key>`. Tuỳ chọn `GEMINI_MODEL` để đổi model (mặc định `gemini-2.5-flash-preview-tts`).
3. Khởi động lại app: 8 giọng hiện với tên `vi-VN-Gemini-Kore`, `vi-VN-Gemini-Charon`... đứng sau giọng MiniMax (nếu có) và trước giọng Google.

Lưu ý: gói miễn phí có giới hạn lượt gọi mỗi phút và mỗi ngày; hết lượt app báo "Gemini đã hết lượt tạo giọng, thử lại sau". Tốc độ đọc chỉ là gợi ý trong lời nhắc (nhanh hơn khi từ 1,15, chậm hơn khi từ 0,9 trở xuống), không chính xác như giọng Google.

## Gợi ý từ khoá cảnh trám bằng AI (Gemini, tuỳ chọn)

Bấm "Tự tìm cảnh còn trống" thì app gửi một lượt tiêu đề + các câu cần cảnh riêng (bỏ đoạn "dùng tiếp") lên `POST /api/keywords`; Gemini đề ra 2–3 từ khoá tiếng Anh tả cảnh nhìn thấy được cho từng câu, khác nhau giữa các câu. Từ khoá hiện trong ô từ khoá của từng cảnh để sửa và "Tìm lại". Khi tự điền, app không gán cùng một ảnh/video (cùng nguồn + id) cho hai cảnh: kết quả đã dùng thì lấy kết quả kế, hết thì thử từ khoá kế.

1. Lấy key ở https://aistudio.google.com (không cần thẻ).
2. Dán vào `.env.local` (hoặc màn Cấu hình `/cai-dat`, hoặc Vercel) dòng `GEMINI_TEXT_API_KEY=<key>`. Tuỳ chọn `GEMINI_TEXT_MODEL` (mặc định `gemini-2.5-flash`).
3. Biến này tách khỏi `GEMINI_API_KEY` (biến kia bật giọng Gemini). Có thể dán cùng một key cho cả hai.

Chưa có key, hết lượt (429) hoặc AI lỗi thì app lặng lẽ dùng từ điển cố định như trước và ghi chú nhẹ "Đang dùng từ khoá từ điển". Khi `FAKE_PROVIDERS=1` tính năng này tắt.

## API (đều cần đăng nhập, trừ đăng nhập)

| Route | Việc |
|---|---|
| `POST /api/auth/login` | `{ username, password }` → cookie phiên |
| `POST /api/auth/logout` | xoá cookie |
| `GET /api/tts/voices` | danh sách giọng `vi-VN` |
| `POST /api/tts` | `{ text, voiceName, speakingRate }` → âm thanh |
| `GET /api/stock/search?q=&kind=image\|video&page=&perPage=` | cảnh trám gộp Pexels + Pixabay |
| `POST /api/keywords` | `{ title?, sentences: string[] }` (≤ 20 câu, mỗi câu ≤ 500 ký tự) → `{ suggestions: [{ queries }] }`; chưa có `GEMINI_TEXT_API_KEY` thì 503 |

## Kiểm tra

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check-env`.

`npm run check-env` kiểm biến môi trường (đọc `.env.local` và `.env`, không in giá trị key) và tự chạy trước `npm run build` (script `prebuild`). Cấu hình sai thì build dừng ngay với lý do rõ.

## Kiểm tra toàn luồng (Playwright)

```bash
npm run test:e2e
```

- Cần trình duyệt Chrome cài sẵn trên máy; dùng Edge thì đặt `PW_CHANNEL=msedge`. Chạy ẩn (headless) vẫn được.
- Tự chạy app ở cổng 3101 với `FAKE_PROVIDERS=1` và tài khoản thử sinh lúc chạy (không dùng tài khoản thật).
- `PW_HEADED=1` (hoặc `npm run test:e2e:headed`) để xem trình duyệt chạy; báo cáo ở `playwright-report/`.
- `AGENTS.md` ở gốc dự án do Next dev sinh ra và đã nằm trong `.gitignore`; không cần sửa hay commit.

## Đo âm một file MP4

```bash
npm run measure:mp4 -- video.mp4
```

Cần cài ffmpeg. Phương pháp đo giữ nguyên các chặng trước: cửa sổ 100 ms, cổng −45 dB, đỉnh < 0,89, giọng −16,5 ± 1 dB.

## So khung với video mẫu

```bash
npm run contact:sheet -- mau.mp4 dung.mp4 so-khung.png 1,8,20
```

Ghép các khung ở giây 1, 8, 20 của hai video thành một ảnh để so mắt.

## Tuỳ chọn video (thanh bên trái)

Mỗi video có tuỳ chọn riêng, lưu trong bản nháp (không thuộc bộ thương hiệu), về mặc định khi bấm "Dự án mới":

- **Phụ đề:** bật/tắt và chọn font (mặc định bật, font Phudu). Phụ đề cháy cứng vào video, hiện từng đoạn ≤ 2 dòng ở đáy cảnh (vùng an toàn TikTok); cảnh mở đầu hiện ngay trên chip tên kênh. Đoạn đổi theo tỉ lệ số chữ trên độ dài giọng đọc (không khớp từng từ).
- **Font chữ tiêu đề và nhãn:** tiêu đề mở đầu, tên kênh, dòng nguồn, tem ngày (mặc định Barlow Condensed như trước).
- **Thumbnail đầu:** màu nền và màu khối sau tiêu đề; "Về mặc định" = theo màu chủ đạo của thương hiệu.
- **Ảnh/Video khi tự tìm:** cả hai / ưu tiên ảnh / ưu tiên video (loại ưu tiên không có kết quả thì lùi về loại còn lại). Ở bước 3, mỗi cảnh có nút "Ảnh | Video" để tìm lại chỉ một loại (bấm lại để bỏ chọn).

Font (Phudu, Be Vietnam Pro, Oswald, Montserrat, Roboto Condensed, Barlow Condensed) nằm trong `public/fonts/` và `public/templates/theanh28/fonts/`, giấy phép SIL OFL (`OFL.txt` cạnh từng họ). Khi dựng chỉ tải font đang chọn. Thêm font: tải `.ttf` từ `github.com/google/fonts` vào `public/fonts/<id>/`, thêm id vào `src/domain/fontIds.ts` và mục vào `src/templates/fonts/FontCatalog.ts`; `npm test` tự kiểm font có đủ chữ tiếng Việt.

So khung có/không phụ đề: `npm run contact:sheet -- co-phu-de.mp4 khong-phu-de.mp4 so-khung.png 1,6,10,20`.

## Kiểu "Video tải lên"

Ở bước 1 chọn **Kiểu video → Video tải lên**: chỉ nhập tiêu đề (+ nguồn tin, ngày đăng, thương hiệu), bấm **Tạo dự án**.

1. **Nhập tiêu đề** — tiêu đề cũng là câu giọng đọc trên thẻ đầu.
2. **Video của bạn** — chọn đúng một video MP4/MOV/WebM, tối đa **5 phút** và **500 MB**. Chỉnh **Âm thanh gốc** 0–150 % (100 % = giữ nguyên, 0 = tắt).
3. **Giọng tiêu đề** — chỉ đọc câu tiêu đề.
4. **Nhạc nền** — tuỳ chọn; tự đặt thấp hơn tiếng gốc ít nhất 12 dB.
5. **Dựng video** — thẻ tiêu đề kiểu Theanh28 (ảnh lấy từ giây 1 của video) rồi video chạy trọn trong khung thân bài: video ngang vừa khung trên nền mờ lấy từ chính video; video dọc hoặc vuông phủ kín khung (cắt gọn hai mép). Không phụ đề. Video dài hơn 1 phút: nên chọn chất lượng **Nhẹ** (file nhỏ, đỡ tốn bộ nhớ) và giữ tab mở khi dựng.

Đã có dự án thì không đổi kiểu được; bấm **Dự án mới** để làm kiểu khác. Track âm của video không giải mã được khi dựng thì việc dựng dừng và báo lỗi (không âm thầm bỏ tiếng gốc): kéo **Âm thanh gốc** về 0 % để dựng không có tiếng gốc, hoặc chuyển video sang MP4 (âm AAC).

Video quay iPhone dạng HEVC (.mov) hoặc có âm AC-3/E-AC-3 có thể không đọc được trên Chrome Windows: xuất lại MP4 (H.264 + AAC) trước khi tải lên, ví dụ bằng ffmpeg:

```bash
ffmpeg -i IMG_0001.MOV -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart IMG_0001.mp4
```

Trên iPhone có thể đặt sẵn **Cài đặt → Camera → Định dạng → Tương thích nhất** để quay thẳng H.264.

Tạo video mẫu để thử: `npm run sample:clip -- test-results/mau.mp4 8` (cần ffmpeg; thêm `--size 1080x1920` cho video dọc, `--no-audio` cho video không tiếng). Đo hiệu năng video dài: `$env:PERF_CLIP="1"; npm run test:e2e -- e2e/08-hieu-nang-video-dai.spec.ts`.

## Deploy lên Vercel (từng bước)

Chỉ Hải chạy các lệnh git và thao tác trên GitHub/Vercel.

1. Tạo repo GitHub **riêng tư**, rồi trong terminal tương tác (không chạy trong phiên tự động vì bị treo ở hộp thoại đăng nhập):
   ```bash
   git remote add origin <địa-chỉ-repo>
   git push -u origin main
   ```
2. Vercel → Add New Project → import repo. Framework: Next.js. Node.js Version: 22.x (Settings → General → Node.js Version).
3. Settings → Environment Variables (tick cả Production và Preview, vì mỗi lần push nhánh Vercel cũng build Preview và `check-env` sẽ chặn nếu thiếu), đặt: `APP_USERS`, `AUTH_SECRET`, `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`; tuỳ chọn `MINIMAX_API_KEY`, `MINIMAX_VOICES`. **Không** đặt `FAKE_PROVIDERS` và `EDGE_TTS_DEV`.
4. Deploy. Build chạy `check-env` trước và dừng nếu thiếu hoặc sai biến.
5. Mở `https://<app>.vercel.app/dang-nhap`, đăng nhập, dựng thử một video.
6. Thêm/sửa người dùng: vào `/tai-khoan` bằng tài khoản `admin`, thao tác như bình thường; trên Vercel màn này không ghi được nên hiện chuỗi `APP_USERS` mới kèm nút Sao chép: dán vào Vercel → Settings → Environment Variables → `APP_USERS` rồi Redeploy (mỗi lần một thay đổi, vì danh sách vẫn là bản đang chạy cho tới khi Redeploy). Cách cũ `npm run user:encode` vẫn dùng được.

Lưu ý:
- Vercel phải cài cả devDependencies khi build (`tsx` cho `prebuild`, Tailwind cho CSS). Mặc định đã vậy; **không** đặt `NPM_CONFIG_PRODUCTION`.
- Gói Hobby chỉ dùng phi thương mại. Giới hạn hàm 10 giây (Hobby) đủ cho TTS từng câu. Giới hạn body 4,5 MB không ảnh hưởng vì file video không lên server.
- Chưa đặt Content-Security-Policy (worker `blob:`/`data:` và CDN Pexels/Pixabay cần liệt kê kỹ): để sau. Đã có các header `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.

## Biến môi trường

| Biến | Bắt buộc? | Cách tạo |
|---|---|---|
| `AUTH_SECRET` | Có | Chuỗi ngẫu nhiên ≥ 32 ký tự: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_USERS` | Có | Base64 của mảng JSON 1–5 tài khoản: `npm run user:entry` rồi `npm run user:encode`. Mỗi tài khoản có `role` tuỳ chọn `admin`/`user` (mặc định `user`) |
| `GOOGLE_TTS_API_KEY` | Có (khi không `FAKE_PROVIDERS`) | Google Cloud Console, bật Cloud Text-to-Speech, tạo API key |
| `PEXELS_API_KEY` | Có (khi không `FAKE_PROVIDERS`) | Đăng ký tại pexels.com/api |
| `PIXABAY_API_KEY` | Có (khi không `FAKE_PROVIDERS`) | Đăng ký tại pixabay.com/api/docs |
| `VCLIP_API_KEY`, `VCLIP_VOICES` | Không (phải có đủ cặp) | Xem mục giọng vclip.io |
| `MINIMAX_API_KEY`, `MINIMAX_VOICES` | Không (phải có đủ cặp) | Xem mục giọng clone MiniMax |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Không | Xem mục giọng Gemini; model mặc định `gemini-2.5-flash-preview-tts` |
| `GEMINI_TEXT_API_KEY`, `GEMINI_TEXT_MODEL` | Không | Xem mục gợi ý từ khoá bằng AI; tách khỏi `GEMINI_API_KEY`; model mặc định `gemini-2.5-flash` |
| `MINIMAX_MODEL`, `MINIMAX_BASE_URL` | Không | Mặc định `speech-2.8-hd` và `https://api.minimax.io` |
| `FAKE_PROVIDERS` | Không, chỉ máy dev | `1` = giọng và cảnh trám giả lập; bật trên production là lỗi |
| `EDGE_TTS_DEV` | Không, chỉ máy dev | `1` = nghe thử giọng Edge qua `edge-tts`; bật khi deploy là lỗi |
| `EDGE_TTS_BIN` | Không | Đường dẫn `edge-tts` nếu không có trong PATH |
