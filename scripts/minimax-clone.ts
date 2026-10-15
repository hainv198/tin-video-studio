import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { MiniMaxCloneClient } from "../src/server/tts/MiniMaxCloneClient";
import { validateAlias } from "../src/server/tts/minimaxShared";

const PREVIEW_TEXT =
  "Xin chào các bạn. Đây là bản tin thử giọng của Tin Video Studio. Chúc các bạn một ngày làm việc hiệu quả.";

const USAGE = [
  "Cách dùng:",
  "  npm run minimax:clone -- <file-thu-am.mp3|m4a|wav> <voiceId> [Alias] [MALE|FEMALE]",
  "Ví dụ:",
  "  npm run minimax:clone -- giong-hai.mp3 tvsHai001 Hai MALE",
  "Alias: chữ và số không dấu, 1–32 ký tự (mặc định Hai). Giới tính mặc định MALE.",
  "Cần MINIMAX_API_KEY trong .env.local. File thu âm 10 giây – 5 phút, tối đa 20 MB.",
].join("\n");

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const [file, voiceId, alias = "Hai", gender = "MALE"] = process.argv.slice(2);
  if (!file || !voiceId || !validateAlias(alias) || (gender !== "MALE" && gender !== "FEMALE")) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error("Thiếu MINIMAX_API_KEY trong .env.local");
    process.exitCode = 1;
    return;
  }

  const client = new MiniMaxCloneClient({
    apiKey,
    baseUrl: process.env.MINIMAX_BASE_URL,
    model: process.env.MINIMAX_MODEL,
  });
  console.log(`Đang tải ${basename(file)} lên MiniMax và clone thành ${voiceId}...`);
  const result = await client.clone({
    audio: readFileSync(file),
    fileName: basename(file),
    voiceId,
    previewText: PREVIEW_TEXT,
  });

  console.log("Clone xong.");
  if (result.demoAudioUrl) console.log(`Nghe thử (link sống 24 giờ): ${result.demoAudioUrl}`);
  console.log("Thêm dòng sau vào mảng MINIMAX_VOICES:");
  console.log(JSON.stringify({ alias, voiceId, gender }));
  console.log("Lưu ý: MiniMax xoá giọng clone nếu 7 ngày không dùng. Hãy tạo giọng thật trong app ít nhất một lần.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
