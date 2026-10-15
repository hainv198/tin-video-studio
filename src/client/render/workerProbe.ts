export interface ProbeScope {
  fonts?: unknown;
  OffscreenCanvas?: unknown;
}

/** Danh sách khả năng mà worker dựng video cần nhưng trình duyệt chưa có (rỗng nếu đủ). */
export function probeWorkerScope(scope: ProbeScope, create2dContext: () => unknown): string[] {
  const missing: string[] = [];
  if (!scope.fonts) missing.push("Nạp font trong worker");
  if (typeof scope.OffscreenCanvas === "undefined") {
    missing.push("OffscreenCanvas");
    return missing;
  }
  let context: unknown = null;
  try {
    context = create2dContext();
  } catch {
    context = null;
  }
  if (!context) missing.push("Canvas 2D trong worker");
  return missing;
}
