import newsKeywords from "@/data/news-keywords.json";

export interface KeywordEntry {
  vi: string[];
  en: string;
}

interface Phrase {
  text: string;
  en: string;
}

const MIN_FOLDED_LENGTH = 4;

const exactForm = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");
const foldForm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
const hasVietnameseMarks = (s: string) => /[^\u0000-\u007f]/.test(s);
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

function buildPhrases(entries: readonly KeywordEntry[], form: (s: string) => string, minLength: number): Phrase[] {
  const seen = new Set<string>();
  const list: Phrase[] = [];
  for (const entry of entries) {
    for (const raw of entry.vi) {
      const text = form(raw).trim();
      if (text.length < minLength || seen.has(text)) continue;
      seen.add(text);
      list.push({ text, en: entry.en });
    }
  }
  return list.sort((a, b) => b.text.length - a.text.length);
}

export class KeywordSuggester {
  private readonly exact: Phrase[];
  private readonly folded: Phrase[];

  constructor(
    entries: readonly KeywordEntry[],
    private readonly fallback = "news",
  ) {
    this.exact = buildPhrases(entries, exactForm, 1);
    this.folded = buildPhrases(entries, foldForm, MIN_FOLDED_LENGTH);
  }

  /** Tối đa `maxQueries` từ khoá tiếng Anh cho một câu tin; không khớp gì thì trả [fallback]. */
  suggest(sentence: string, maxQueries = 3): string[] {
    const typedWithoutMarks = !hasVietnameseMarks(sentence);
    const text = typedWithoutMarks ? foldForm(sentence) : exactForm(sentence);
    const phrases = typedWithoutMarks ? this.folded : this.exact;

    const claimed = new Array<boolean>(text.length).fill(false);
    const scores = new Map<string, { weight: number; first: number }>();
    for (const { text: phrase, en } of phrases) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(phrase, from);
        if (at < 0) break;
        from = at + 1;
        const end = at + phrase.length;
        if (isWordChar(text[at - 1]) || isWordChar(text[end])) continue;
        if (claimed.slice(at, end).some(Boolean)) continue;
        claimed.fill(true, at, end);
        const current = scores.get(en);
        scores.set(en, { weight: (current?.weight ?? 0) + phrase.length, first: Math.min(current?.first ?? at, at) });
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1].weight - a[1].weight || a[1].first - b[1].first)
      .slice(0, maxQueries)
      .map(([en]) => en);
    return ranked.length > 0 ? ranked : [this.fallback];
  }
}

export function defaultKeywordSuggester(fallback = "news"): KeywordSuggester {
  return new KeywordSuggester(newsKeywords as KeywordEntry[], fallback);
}
