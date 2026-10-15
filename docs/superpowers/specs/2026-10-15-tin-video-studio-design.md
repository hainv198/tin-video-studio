# Tin Video Studio — Đặc tả thiết kế

- Ngày: 2026-10-15
- Chủ dự án: Hải
- Trạng thái: chờ Hải duyệt đặc tả
- Video mẫu tham chiếu: TikTok @theanh28entertainment, video 7696506064186969364 (tin Phú Thọ, 62 giây)

## 1. Mục tiêu

Web app dựng video tin tức dọc 9:16 kiểu Theanh28 từ một đoạn text, deploy trên Vercel.

- Người dùng dán tin, chọn giọng, duyệt cảnh trám, chọn nhạc, bấm dựng, tải MP4 về máy.
- Video được dựng **trên trình duyệt người dùng**. File của họ lưu trên máy họ. Server chỉ giữ key và làm proxy API.
- Có **nhiều phong cách video**. Bản đầu có 1 phong cách (Theanh28). Thêm phong cách mới không phải sửa phần còn lại.
- Mã nguồn theo **MVC + OOP chặt chẽ**.

### Ngoài phạm vi bản đầu

- Trình dựng thanh thời gian kiểu CapCut / Timeline Studio.
- Phụ đề chạy theo lời (phong cách Theanh28 không có). Phong cách sau cần thì tự vẽ trong lớp phong cách.
- Clone giọng. Chỉ dùng giọng có sẵn của Google Cloud TTS.
- Thanh toán, gói cước, đăng ký tài khoản tự phục vụ.
- Dựng video trên server.

## 2. Người dùng và quyền

- Tối đa **5 tài khoản**, do Hải cấp. Không có trang đăng ký.
- Tài khoản khai báo trong biến môi trường `APP_USERS` (JSON: `[{ "username", "passwordHash", "displayName" }]`, mật khẩu băm bcrypt). Thêm bớt người = sửa biến + deploy lại.
- Mọi trang và mọi API (trừ trang đăng nhập) đều yêu cầu đăng nhập.
- Lưu ý điều khoản: gói Hobby của Vercel chỉ cho dùng phi thương mại. Thu tiền người dùng thì phải lên gói Pro.

## 3. Luồng sử dụng (5 bước)

### Bước 1 — Nhập tin
- Ô dán text tin. Ô tiêu đề (mặc định lấy câu đầu). Ô "Theo: …" (nguồn tin, ví dụ `Đức Phong - VietNamNet`). Ngày đăng (mặc định hôm nay, định dạng `dd/mm/yyyy`).
- Chọn phong cách video (danh sách từ registry phong cách).
- App chia text thành cảnh, **mỗi câu một cảnh**. Câu tiêu đề là cảnh mở đầu.
- Quy tắc chia câu: tách tại `.`, `!`, `?`, xuống dòng — chỉ khi sau dấu là khoảng trắng + chữ hoa hoặc hết đoạn. Không tách số kiểu `1.116,2` hay `3.357`. Người dùng sửa, gộp, tách cảnh bằng tay được.

### Bước 2 — Chọn giọng
- Danh sách giọng `vi-VN` lấy từ Google Cloud TTS (nam / nữ, các hạng Standard, WaveNet, Neural2, Chirp 3 HD tuỳ Google đang có). Nút nghe thử đọc câu tiêu đề.
- Thanh tốc độ đọc (0.8–1.3, mặc định 1.07 — khớp nhịp video mẫu).
- Bấm "Tạo giọng": app gọi TTS **riêng cho từng câu**, hiện tiến độ. Kết quả: mỗi cảnh có file giọng và độ dài chính xác.
- Câu nào lỗi thì đánh dấu đỏ, có nút thử lại riêng câu đó.
- Khoảng nghỉ giữa các câu: 0.35 giây (cấu hình theo phong cách).

### Bước 3 — Duyệt cảnh trám
- Người dùng tải ảnh / video của họ lên (JPG, PNG, WebP, MP4, WebM, MOV). App gán **lần lượt** theo thứ tự cảnh.
- Cảnh còn trống: app đoán từ khoá tiếng Anh từ câu tin (xem §6.3) rồi tìm trên Pexels (ảnh + video) và Pixabay (ảnh + video), tự chọn kết quả đầu.
- Mỗi cảnh hiện: câu tin, cảnh trám đang chọn, 6–8 lựa chọn khác, ô từ khoá sửa được + nút tìm lại, nút tải file thay thế, nút hoán đổi với cảnh khác.
- Một file tải lên có thể dùng cho nhiều cảnh.
- Ảnh: hiệu ứng zoom chậm (Ken Burns). Video: cắt đoạn đầu vừa độ dài cảnh, tắt tiếng; video ngắn hơn cảnh thì lặp lại.
- Không tìm ra kết quả: cảnh dùng nền mặc định của phong cách.

### Bước 4 — Chọn nhạc
- Kho nhạc có sẵn do Hải cung cấp, nút nghe thử. Hoặc tải file nhạc của người dùng (MP3, WAV, M4A). Hoặc không nhạc.
- Âm lượng nhạc mặc định thấp hơn giọng 15 dB (đo từ video mẫu), có thanh chỉnh ±6 dB. Fade in 1.5 giây, fade out 2 giây. Nhạc ngắn hơn video thì lặp.

### Bước 5 — Dựng và tải về
- Nút "Dựng video". Thanh tiến độ theo %, nút huỷ.
- Xong: trình phát xem lại + nút tải MP4. Tên file: `slug-tieu-de_yyyymmdd.mp4`.

### Lưu trữ phía người dùng
- Bộ thương hiệu theo từng phong cách (logo, tên kênh, màu), file tải lên, nhạc tải lên, bản nháp dự án gần nhất: lưu trong IndexedDB của trình duyệt.
- Giọng đã tạo lưu cùng bản nháp để mở lại không phải tạo lại.
- Server không lưu file nào.

## 4. Kiến trúc

Next.js (App Router) + TypeScript + Tailwind, deploy Vercel. Cùng bộ công nghệ với `ca-nhan/tools/hainv-platform`.

### 4.1 Bốn lớp, chỉ gọi xuống lớp ngay dưới

| Lớp | Trách nhiệm | Được phụ thuộc |
|---|---|---|
| View | Component React của 5 bước. Chỉ hiển thị + chuyển thao tác cho controller. Không gọi fetch, không chứa quy tắc nghiệp vụ. | Controller (qua hook) |
| Controller | Mỗi bước một lớp. Giữ trạng thái bước, điều phối service, cập nhật model. Phát sự kiện thay đổi cho view. | Model, Service (qua interface) |
| Model | Lớp nghiệp vụ thuần TS, không đụng React / DOM / fetch. Bất biến dữ liệu được kiểm trong constructor / method. | Không gì cả |
| Service | Làm việc với bên ngoài: API, IndexedDB, WebCodecs, Web Audio. Mỗi service có interface; controller chỉ biết interface. | Model |

Phía server: route handler là lớp mỏng → controller phía server → service phía server.

Phụ thuộc được lắp ở một chỗ duy nhất (`src/client/container.ts` và `src/server/container.ts`) để test thay bằng bản giả.

### 4.2 Cấu trúc thư mục

```
src/
  app/                          # Next.js routes (mỏng)
    (auth)/dang-nhap/page.tsx
    studio/page.tsx             # trình 5 bước
    api/tts/route.ts
    api/tts/voices/route.ts
    api/stock/search/route.ts
    api/auth/[...nextauth]/route.ts
  domain/                       # MODEL — thuần TS
    NewsProject.ts
    Scene.ts
    Footage.ts                  # cảnh trám: ImageFootage | VideoFootage | FallbackFootage
    VoiceSettings.ts
    Narration.ts                # giọng của 1 cảnh: audio + duration
    MusicTrack.ts
    BrandKit.ts
    Timeline.ts                 # tính mốc thời gian từng cảnh từ Narration
    SentenceSplitter.ts
    errors.ts
  templates/                    # PHONG CÁCH — model + logic vẽ
    VideoTemplate.ts            # lớp trừu tượng
    TemplateRegistry.ts
    theanh28/
      TheAnh28Template.ts
      layout.ts                 # toạ độ, cỡ chữ, màu mặc định
  client/
    controllers/
      ProjectController.ts      # bước 1
      VoiceController.ts        # bước 2
      FootageController.ts      # bước 3
      MusicController.ts        # bước 4
      RenderController.ts       # bước 5
      WizardController.ts       # điều hướng bước, kiểm điều kiện qua bước
    services/
      TtsClient.ts              # gọi /api/tts
      StockClient.ts            # gọi /api/stock/search
      KeywordSuggester.ts       # đoán từ khoá tiếng Anh (§6.3)
      LocalStore.ts             # IndexedDB
      AudioMixer.ts             # OfflineAudioContext
      FrameRenderer.ts          # vẽ khung bằng template lên OffscreenCanvas
      VideoEncoderService.ts    # WebCodecs + mux MP4
      BrowserSupport.ts         # kiểm WebCodecs / OffscreenCanvas
    workers/render.worker.ts
    container.ts
  server/
    controllers/TtsController.ts
    controllers/StockController.ts
    services/GoogleTtsService.ts
    services/PexelsService.ts
    services/PixabayService.ts
    services/UserDirectory.ts   # đọc APP_USERS
    container.ts
  views/                        # VIEW — component React
    steps/StepNews.tsx
    steps/StepVoice.tsx
    steps/StepFootage.tsx
    steps/StepMusic.tsx
    steps/StepRender.tsx
    components/…
    hooks/useController.ts      # đăng ký nghe sự kiện controller
public/
  music/                        # kho nhạc của Hải + manifest.json
  templates/theanh28/           # ảnh nền bản đồ thế giới, font
tests/
```

### 4.3 Hợp đồng phong cách video

```ts
abstract class VideoTemplate {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly brandFields: BrandFieldSpec[];     // logo, tên kênh, màu…
  abstract readonly defaults: TemplateDefaults;         // khoảng nghỉ, màu nền dự phòng, fps
  abstract preload(ctx: TemplateAssets): Promise<void>; // nạp font, ảnh nền
  abstract drawIntro(c: DrawContext, scene: SceneFrame, t: number): void;
  abstract drawBody(c: DrawContext, scene: SceneFrame, t: number): void;
  drawOverlay(c: DrawContext, project: ProjectFrame, t: number): void {} // chữ cố định suốt video
}
```

- `t` là giây tính từ đầu cảnh. Hàm vẽ phải **thuần theo thời gian** (cùng `t` ra cùng hình) để dựng chính xác từng khung.
- `TemplateRegistry` giữ danh sách phong cách. Thêm phong cách = thêm 1 lớp con + 1 dòng đăng ký.

### 4.4 Phong cách Theanh28 (đo từ video mẫu, khung 1080×1920)

**Cảnh mở đầu** (bằng độ dài câu tiêu đề, mẫu ≈ 5.7 giây)
- Cảnh trám phủ nửa trên (0 → ~1000 px), zoom chậm.
- Nửa dưới: nền gradient màu chủ đạo (mặc định xanh lá) có hoạ tiết bản đồ thế giới mờ, chuyển mượt lên ảnh.
- Chip thương hiệu bo tròn: logo + tên kênh, ở ~y 1040.
- Tem "NGÀY ĐĂNG: dd/mm/yyyy" nền mờ, ~y 1160.
- Tiêu đề in hoa, chữ trắng đậm (font condensed), tối đa 3 dòng, ~y 1220.

**Cảnh thân bài**
- Nền: chính cảnh trám phóng to + làm mờ mạnh, phủ toàn khung.
- Cảnh trám rõ nét ở dải giữa (~y 380 → ~1300), full chiều ngang, zoom chậm 100% → 108% trong cảnh.
- Tem "NGÀY ĐĂNG" ở mép dưới trái của dải ảnh.

**Lớp chữ cố định** (cả video)
- Trên trái: `THEO: <nguồn tin>` / `ẢNH: TỔNG HỢP`, chữ trắng nhỏ in hoa.
- Trên phải (từ cảnh thân bài): logo + tên kênh.

**Chuyển cảnh**: cắt thẳng hoặc mờ chồng 0.2 giây. Không phụ đề.

Toạ độ chính xác sẽ tinh chỉnh khi so khung với video mẫu (§8).

## 5. Dựng video phía người dùng

1. `Timeline` tính mốc từng cảnh từ độ dài giọng + khoảng nghỉ + 0.3 giây đệm đầu, 0.6 giây đệm cuối.
2. `AudioMixer` (OfflineAudioContext, 48 kHz stereo): ghép giọng theo mốc, chuẩn hoá giọng về ~-14 LUFS, nhạc thấp hơn giọng 15 dB (± chỉnh của người dùng), fade, limiter. Ra một buffer âm thanh.
3. `render.worker` nhận dự án đã "đóng băng" (dữ liệu thuần + ImageBitmap + file video). Với mỗi khung `i` (30 fps): `t = i/30` → `FrameRenderer` gọi template vẽ lên OffscreenCanvas 1080×1920 → `VideoFrame` → `VideoEncoder` (H.264, ~8 Mbps).
4. Cảnh trám video: tách luồng (demux) + giải mã bằng `VideoDecoder` ngay trong worker, lấy khung gần nhất theo thời gian. Không dùng phần tử `<video>` vì worker không có DOM. Thư viện mux ở bước 6 nên chọn loại có cả demux để dùng chung.
5. `AudioEncoder` (AAC 192 kbps) mã hoá buffer âm thanh.
6. Mux thành MP4 bằng thư viện muxer chạy trên trình duyệt (chọn ở bước lập kế hoạch; ứng viên: `mediabunny`, `mp4-muxer`).
7. Trả `Blob` về giao diện để xem lại và tải về.

Kiểm trình duyệt khi mở app: thiếu `VideoEncoder` / `AudioEncoder` / `OffscreenCanvas` hoặc không mã hoá được H.264 thì hiện thông báo "Hãy dùng Chrome hoặc Edge bản mới" và khoá bước 5.

## 6. Server

### 6.1 API (đều yêu cầu đăng nhập)

| Route | Vào | Ra |
|---|---|---|
| `GET /api/tts/voices` | — | danh sách giọng `vi-VN`: `{ name, gender, tier }` (cache 1 ngày) |
| `POST /api/tts` | `{ text, voiceName, speakingRate }` | audio MP3 (`audio/mpeg`) |
| `GET /api/stock/search` | `?q=&kind=image\|video&page=` | `{ items: [{ provider, id, kind, thumbUrl, fullUrl, width, height, duration?, author, pageUrl }] }` gộp Pexels + Pixabay |

- `POST /api/tts` từ chối text > 5.000 ký tự (lỗi 413). Mỗi câu gọi một lần nên thực tế rất ngắn.
- Ảnh / video stock: trình duyệt tải thẳng từ CDN của Pexels / Pixabay, không đi qua server. Nếu CDN chặn CORS thì thêm route proxy tải file (kiểm ở giai đoạn code).
- Không có file nào gửi lên server (giới hạn body của hàm Vercel là 4.5 MB).

### 6.2 Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `GOOGLE_TTS_API_KEY` | key Google Cloud Text-to-Speech của Hải |
| `PEXELS_API_KEY` | key Pexels của Hải |
| `PIXABAY_API_KEY` | key Pixabay của Hải |
| `APP_USERS` | danh sách ≤ 5 tài khoản (JSON, mật khẩu băm bcrypt) |
| `AUTH_SECRET` | khoá ký phiên đăng nhập |

Kèm script `npm run hash-password` để Hải tạo mật khẩu băm.

### 6.3 Đoán từ khoá tiếng Anh

- `KeywordSuggester` dùng từ điển tin tức Việt → Anh viết sẵn (≈ 200 cụm: công an → police, toà án / xét xử → court gavel, tiền / tỷ đồng → money cash, đất / thửa đất → land plot, trụ sở → office building, tai nạn → accident, bệnh viện → hospital, mưa lũ → flood…).
- Khớp cụm dài trước. Lấy tối đa 3 cụm có trọng số cao nhất của câu. Không khớp gì thì dùng từ khoá chung của phong cách (`news`, `city aerial`).
- Từ điển là file dữ liệu riêng, Hải bổ sung được không cần sửa code.

## 7. Xử lý lỗi

| Tình huống | Cách xử lý |
|---|---|
| Hết phiên đăng nhập | API trả 401, giao diện đưa về trang đăng nhập, giữ bản nháp trong IndexedDB |
| TTS lỗi một câu | đánh dấu câu đó, thử lại riêng; không qua bước 3 khi còn câu lỗi |
| Google trả lỗi hạn mức | báo rõ "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" |
| Stock không có kết quả | gợi ý sửa từ khoá; vẫn cho qua bước bằng nền mặc định |
| Pexels / Pixabay quá giới hạn lượt | báo người dùng, nguồn còn lại vẫn chạy |
| File tải lên quá lớn / sai định dạng | chặn từ đầu: ảnh ≤ 20 MB, video ≤ 300 MB, nhạc ≤ 30 MB |
| Trình duyệt không hỗ trợ | §5, khoá bước 5 |
| Lỗi giữa lúc dựng | dừng worker, báo lỗi kèm khung đang dựng, cho dựng lại |
| Người dùng huỷ | dừng worker, giải phóng bộ nhớ |

## 8. Kiểm thử

- **Unit (Vitest)**: model (chia câu, timeline, bất biến), controller với service giả, `KeywordSuggester`, `AudioMixer` (mức âm tương đối), service server với `fetch` giả.
- **Template**: vẽ khung ở các mốc `t` cố định ra PNG, so ảnh chụp chuẩn để phát hiện vỡ bố cục.
- **API**: route handler với service giả; kiểm 401 khi chưa đăng nhập, 413 khi text dài.
- **Toàn luồng (Playwright, Chrome)**: đăng nhập → 5 bước → có file MP4; API bên ngoài giả lập.
- **Nghiệm thu thủ công**: dựng lại đúng tin Phú Thọ, so khung hình với video mẫu (bố cục, cỡ chữ, nhịp) và đo mức âm (giọng ≈ -16.5 dB trung bình, nhạc ở khoảng nghỉ ≈ -30 dB như mẫu).

## 9. Việc của Hải (cần trước khi chạy thật)

1. Tạo dự án Google Cloud, gắn thanh toán, bật Text-to-Speech API, tạo API key (giới hạn key chỉ cho API này). Đặt hạn mức theo ngày + cảnh báo ngân sách.
2. Đăng ký key miễn phí Pexels và Pixabay.
3. Gửi các file nhạc cho kho có sẵn (anh chịu trách nhiệm bản quyền).
4. Tài khoản Vercel (+ GitHub nếu deploy qua GitHub). Bước đăng nhập / push do Hải chạy.
5. Danh sách tối đa 5 người dùng.
6. Logo / tên kênh để làm bộ thương hiệu mặc định (không bắt buộc, mỗi người tự đặt được).

Trong lúc chờ, bản phát triển dùng service giả cho TTS và stock để code và test được ngay.

## 10. Bổ sung 2026-10-15: giọng clone qua MiniMax

Hải muốn dùng giọng clone (giọng của Hải hoặc người đã đồng ý; không clone giọng người đọc của kênh khác).

- **Nhà cung cấp thứ hai, tuỳ chọn.** `MiniMaxTtsService` cài cùng interface `TtsProvider` với Google. Chỉ bật khi có đủ `MINIMAX_API_KEY` và `MINIMAX_VOICES`. Thiếu một trong hai, hoặc `MINIMAX_VOICES` sai định dạng, thì ghi cảnh báo (không lộ key) và app chạy như cũ, không lỗi.
- **Tên giọng trong app:** `vi-VN-MiniMax-<Alias>` (Alias: chữ và số, 1–32 ký tự). Vẫn qua chốt `vi-VN` và `VoiceSettings`. Hạng hiển thị: `MiniMax`. Giọng MiniMax đứng đầu danh sách.
- **Định tuyến:** `RoutingTtsProvider` gộp danh sách giọng của các nhà cung cấp (một nguồn lỗi thì vẫn trả các nguồn còn lại, đánh dấu danh sách thiếu để không bị cache 24 giờ) và chuyển yêu cầu tạo giọng theo tên giọng.
- **Gọi API:** `POST {MINIMAX_BASE_URL}/v1/t2a_v2`, header `Authorization: Bearer <key>`, body `{ model, text, stream:false, language_boost:"Vietnamese", output_format:"hex", voice_setting:{ voice_id, speed }, audio_setting:{ format:"mp3", sample_rate:44100, bitrate:128000, channel:1 } }`. `speed` = tốc độ đọc của app (0.8–1.3, nằm trong 0.5–2 của MiniMax). Âm thanh trả về dạng hex trong `data.audio`. Lỗi nằm ở `base_resp.status_code` (HTTP vẫn 200): 1002/1039 → hết hạn mức (429), còn lại → lỗi nhà cung cấp (502).
- **Biến môi trường:** `MINIMAX_API_KEY`, `MINIMAX_VOICES` = JSON `[{"alias":"Hai","voiceId":"tvsHai001","gender":"MALE"}]`, `MINIMAX_MODEL` (mặc định `speech-2.8-hd`), `MINIMAX_BASE_URL` (mặc định `https://api.minimax.io`).
- **Clone một lần:** `npm run minimax:clone -- <file-thu-am> <voiceId> [Alias] [MALE|FEMALE]` đọc `.env.local`, tải file lên (`/v1/files/upload`, purpose `voice_clone`), gọi `/v1/voice_clone` (lọc ồn + chuẩn hoá âm lượng, kèm câu nghe thử) rồi in link nghe thử và dòng cần thêm vào `MINIMAX_VOICES`. File thu âm: mp3/m4a/wav, 10 giây – 5 phút, ≤ 20 MB. `voiceId`: 8–256 ký tự, bắt đầu bằng chữ, chỉ chữ/số/`-`/`_`, không kết thúc bằng `-`/`_`.
- **Lưu ý từ MiniMax:** giọng clone không được dùng trong 7 ngày sẽ bị xoá. Sau khi clone phải tạo giọng thật ít nhất một lần trong 7 ngày.
