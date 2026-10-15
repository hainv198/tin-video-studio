import { QuotaError, UpstreamError } from "@/domain/errors";

export interface UpstreamLabels {
  service: string;
  quotaMessage: string;
  /** Chuỗi bí mật (key) phải che trước khi ghi log thân lỗi của nhà cung cấp. */
  redact?: readonly string[];
}

function redacted(text: string, secrets: readonly string[] | undefined): string {
  let out = text;
  for (const s of secrets ?? []) if (s) out = out.split(s).join("[đã che]");
  return out;
}

export async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  labels: UpstreamLabels,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new UpstreamError(`Không kết nối được ${labels.service}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429 || detail.includes("RESOURCE_EXHAUSTED")) throw new QuotaError(labels.quotaMessage);
    console.warn(`[${labels.service}] HTTP ${response.status}: ${redacted(detail, labels.redact).slice(0, 300)}`);
    throw new UpstreamError(`${labels.service} lỗi ${response.status}`);
  }
  return (await response.json()) as T;
}
