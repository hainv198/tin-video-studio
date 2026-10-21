import { SentenceSplitter } from "@/domain/SentenceSplitter";

export interface ChunkOptions {
  /** Số ký tự tối đa mỗi mẩu (máy chủ nhận tối đa 5.000). */
  maxChars?: number;
  /** Số câu tối đa mỗi mẩu: 1–3 câu cho giọng tự nhiên mà không quá nhiều lần gọi. */
  maxSentences?: number;
}

export const CHUNK_MAX_CHARS = 4500;
const DEFAULT_MAX_SENTENCES = 3;

/** Tách văn bản dài thành các mẩu gửi đi tạo giọng: theo đoạn (xuống dòng) rồi theo câu, giữ nguyên thứ tự. */
export class SpeechChunker {
  private readonly maxChars: number;
  private readonly maxSentences: number;
  private readonly splitter = new SentenceSplitter();

  constructor(options: ChunkOptions = {}) {
    this.maxChars = options.maxChars ?? CHUNK_MAX_CHARS;
    this.maxSentences = options.maxSentences ?? DEFAULT_MAX_SENTENCES;
  }

  split(text: string): string[] {
    const chunks: string[] = [];
    for (const paragraph of text.replace(/\r\n?/g, "\n").split(/\n+/)) {
      let current: string[] = [];
      const flush = () => {
        if (current.length) chunks.push(current.join(" "));
        current = [];
      };
      for (const sentence of this.splitter.split(paragraph).flatMap((s) => this.cutLong(s))) {
        const joinedLength = current.length ? current.join(" ").length + 1 + sentence.length : sentence.length;
        if (current.length >= this.maxSentences || joinedLength > this.maxChars) flush();
        current.push(sentence);
      }
      flush();
    }
    return chunks;
  }

  /** Câu dài hơn giới hạn: cắt ở khoảng trắng gần giới hạn nhất; không có khoảng trắng thì cắt cứng. */
  private cutLong(sentence: string): string[] {
    const pieces: string[] = [];
    let rest = sentence;
    while (rest.length > this.maxChars) {
      const space = rest.lastIndexOf(" ", this.maxChars);
      const cut = space > 0 ? space : this.maxChars;
      pieces.push(rest.slice(0, cut));
      rest = rest.slice(space > 0 ? cut + 1 : cut);
    }
    if (rest) pieces.push(rest);
    return pieces;
  }
}
