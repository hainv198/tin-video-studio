import { UpstreamError, ValidationError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";

export const GEMINI_TEXT_DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const TIMEOUT_MS = 20_000;
export const MAX_SENTENCES = 20;
export const MAX_SENTENCE_LENGTH = 500;
export const MAX_TITLE_LENGTH = 200;
const MAX_QUERIES = 3;
const MAX_QUERY_LENGTH = 40;
const LABELS = { service: "Gemini (từ khoá)", quotaMessage: "Gemini đã hết lượt gợi ý từ khoá, thử lại sau" };

export interface KeywordRequest {
  title?: string;
  sentences: string[];
}

export interface SentenceKeywords {
  queries: string[];
}

export interface GeminiKeywordOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  promptFeedback?: { blockReason?: string };
}

function responseSchema(count: number) {
  return {
    type: "ARRAY",
    minItems: count,
    maxItems: count,
    items: {
      type: "OBJECT",
      properties: { queries: { type: "ARRAY", minItems: 2, maxItems: 3, items: { type: "STRING" } } },
      required: ["queries"],
    },
  };
}

function buildPrompt(title: string, sentences: readonly string[]): string {
  const lines = sentences.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return [
    "You pick stock footage search terms (Pexels/Pixabay) for a Vietnamese news video.",
    `For EACH of the ${sentences.length} numbered sentences below, return 3 search queries in English, 2-4 words each.`,
    "Each query must describe a concrete, visible scene: people, places, actions or objects a camera can film.",
    "Avoid abstract words, emotions, numbers, and proper names (no people, brands, cities or countries).",
    "Do NOT reuse the same main query across sentences: give every sentence a different visual angle while staying on the story's topic.",
    "For transitional sentences with little visual content, choose a general setting shot that fits the story.",
    `Return a JSON array with exactly ${sentences.length} items in the same order, each {"queries": [...]}.`,
    "",
    `Headline: ${title || "(none)"}`,
    "Sentences:",
    lines,
  ].join("\n");
}

/** Chuẩn hoá một từ khoá: chữ thường, chỉ chữ/số/khoảng trắng/gạch nối, tối đa 40 ký tự. */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

function queriesOf(entry: unknown): string[] {
  const list = entry && typeof entry === "object" && Array.isArray((entry as { queries?: unknown }).queries)
    ? ((entry as { queries: unknown[] }).queries)
    : [];
  const out: string[] = [];
  for (const raw of list) {
    const q = normalizeQuery(raw);
    if (q && !out.includes(q)) out.push(q);
    if (out.length >= MAX_QUERIES) break;
  }
  return out;
}

function assertInput(input: unknown): { title: string; sentences: string[] } {
  if (!input || typeof input !== "object") throw new ValidationError("Yêu cầu gợi ý từ khoá không hợp lệ");
  const { title, sentences } = input as { title?: unknown; sentences?: unknown };
  if (title !== undefined && typeof title !== "string") throw new ValidationError("Tiêu đề phải là chữ");
  if (!Array.isArray(sentences) || sentences.length === 0) throw new ValidationError("Cần ít nhất một câu");
  if (sentences.length > MAX_SENTENCES) throw new ValidationError(`Tối đa ${MAX_SENTENCES} câu mỗi lần`);
  if (!sentences.every((s): s is string => typeof s === "string")) throw new ValidationError("Mỗi câu phải là chữ");
  if (sentences.some((s) => s.length > MAX_SENTENCE_LENGTH)) throw new ValidationError(`Mỗi câu tối đa ${MAX_SENTENCE_LENGTH} ký tự`);
  if ((title ?? "").length > MAX_TITLE_LENGTH) throw new ValidationError(`Tiêu đề tối đa ${MAX_TITLE_LENGTH} ký tự`);
  return { title: (title ?? "").trim(), sentences: sentences.map((s) => s.trim()) };
}

/** Nhờ Gemini đọc từng câu tin và đề ra từ khoá tìm cảnh trám cụ thể, khác nhau giữa các câu. */
export class GeminiKeywordService {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiKeywordOptions) {
    if (!options.apiKey) throw new Error("GEMINI_TEXT_API_KEY chưa được cấu hình");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async suggest(input: KeywordRequest): Promise<SentenceKeywords[]> {
    const { title, sentences } = assertInput(input);
    const body = {
      contents: [{ parts: [{ text: buildPrompt(title, sentences) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema(sentences.length) },
    };
    const baseUrl = this.options.baseUrl || DEFAULT_BASE_URL;
    const model = this.options.model || GEMINI_TEXT_DEFAULT_MODEL;
    const data = await fetchJson<GenerateContentResponse>(
      this.fetchImpl,
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      { ...LABELS, redact: [this.options.apiKey] },
    );
    if (data.promptFeedback?.blockReason) throw new UpstreamError("Gemini từ chối gợi ý từ khoá cho bản tin này");
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text.trim()) throw new UpstreamError("Gemini không trả về từ khoá");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new UpstreamError("Gemini trả về từ khoá không đọc được");
    }
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
        ? (parsed as { suggestions: unknown[] }).suggestions
        : [];
    return dedupeAcrossSentences(sentences.map((_s, i) => queriesOf(list[i])));
  }
}

/** Từ khoá đầu của một câu trùng từ khoá đầu của câu trước thì đẩy từ khoá kế (chưa dùng) lên đầu. */
function dedupeAcrossSentences(perSentence: string[][]): SentenceKeywords[] {
  const primaries = new Set<string>();
  return perSentence.map((queries) => {
    const fresh = queries.findIndex((q) => !primaries.has(q));
    const ordered = fresh > 0 ? [queries[fresh] as string, ...queries.filter((_q, i) => i !== fresh)] : queries;
    if (ordered[0]) primaries.add(ordered[0]);
    return { queries: ordered };
  });
}
