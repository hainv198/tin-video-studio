import { ApiError, readApiError, readJson } from "./apiError";

/** Khớp giới hạn của POST /api/keywords. */
const BATCH_SIZE = 20;
const MAX_SENTENCE_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

export interface KeywordAiApi {
  /** Mỗi câu một danh sách từ khoá tiếng Anh (có thể rỗng), đúng thứ tự và số câu. */
  suggest(title: string, sentences: readonly string[], signal?: AbortSignal): Promise<string[][]>;
}

const badResponse = () => new ApiError(502, "BAD_RESPONSE", "Máy chủ trả về dữ liệu không đọc được");

export class KeywordClient implements KeywordAiApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async suggest(title: string, sentences: readonly string[], signal?: AbortSignal): Promise<string[][]> {
    const shortTitle = title.slice(0, MAX_TITLE_LENGTH);
    const batches: string[][] = [];
    for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
      batches.push(sentences.slice(i, i + BATCH_SIZE).map((s) => s.slice(0, MAX_SENTENCE_LENGTH)));
    }
    const results = await Promise.all(batches.map((batch) => this.request(shortTitle, batch, signal)));
    return results.flat();
  }

  private async request(title: string, sentences: string[], signal?: AbortSignal): Promise<string[][]> {
    const response = await this.fetchImpl("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sentences }),
      signal,
    });
    if (!response.ok) throw await readApiError(response);
    const body = await readJson<{ suggestions?: unknown }>(response);
    const list = body.suggestions;
    if (!Array.isArray(list) || list.length !== sentences.length) throw badResponse();
    return list.map((entry) => {
      const queries = (entry as { queries?: unknown } | null)?.queries;
      if (!Array.isArray(queries) || !queries.every((q) => typeof q === "string")) throw badResponse();
      return queries as string[];
    });
  }
}
