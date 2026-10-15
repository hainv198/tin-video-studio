const SENTENCE_END = /[.!?…]/;
const TRAILING_MARK = /[.!?…"”'’)\]]/;
const NEXT_SENTENCE_START = /^\s+["“'‘(\[]?[\p{Lu}\p{N}]/u;
const ABBREVIATIONS = new Set(["TP", "Tp", "TS", "ThS", "PGS", "GS", "BS", "Q", "P", "St", "Mr", "Mrs", "Dr"]);

export class SentenceSplitter {
  split(text: string): string[] {
    const sentences: string[] = [];
    const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n+/);
    for (const paragraph of paragraphs) this.splitParagraph(paragraph, sentences);
    return sentences;
  }

  private splitParagraph(paragraph: string, out: string[]): void {
    let start = 0;
    for (let i = 0; i < paragraph.length; i++) {
      const ch = paragraph.charAt(i);
      if (!SENTENCE_END.test(ch)) continue;

      let end = i + 1;
      while (end < paragraph.length && TRAILING_MARK.test(paragraph.charAt(end))) end++;

      const rest = paragraph.slice(end);
      const isParagraphEnd = rest.trim() === "";
      const nextLooksLikeSentence = NEXT_SENTENCE_START.test(rest);
      const isAbbreviation = ch === "." && this.endsWithAbbreviation(paragraph.slice(start, i));

      if (isParagraphEnd || (nextLooksLikeSentence && !isAbbreviation)) {
        this.push(out, paragraph.slice(start, end));
        start = end;
      }
      i = end - 1;
    }
    this.push(out, paragraph.slice(start));
  }

  private endsWithAbbreviation(chunk: string): boolean {
    const lastWord = chunk.trim().split(/\s+/).pop() ?? "";
    return ABBREVIATIONS.has(lastWord);
  }

  private push(out: string[], raw: string): void {
    const sentence = raw.replace(/\s+/g, " ").trim();
    if (sentence) out.push(sentence);
  }
}
