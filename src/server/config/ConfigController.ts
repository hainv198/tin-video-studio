import { ValidationError } from "@/domain/errors";
import { assertValidValue, CONFIG_KEYS, findConfigKey, type ConfigKind } from "./configKeys";
import type { EnvWriter } from "./EnvFileWriter";

type Env = Record<string, string | undefined>;

/** Trạng thái một khoá: chỉ "đã đặt hay chưa" (và số mục với JSON), không bao giờ có giá trị. */
export interface ConfigKeyStatus {
  key: string;
  label: string;
  hint: string;
  kind: ConfigKind;
  isSet: boolean;
  count?: number;
}

export interface ConfigSnapshot {
  editable: boolean;
  readOnlyReason: string | null;
  keys: ConfigKeyStatus[];
}

export interface ConfigUpdateResult extends ConfigSnapshot {
  changed: string[];
  restartRequired: boolean;
}

export interface ConfigControllerOptions {
  writer: EnvWriter;
  env: Env;
  /** Gọi sau khi lưu để làm mới các đối tượng server đang giữ cache (container). */
  onApplied: () => void;
}

const VERCEL_REASON = "Đang chạy trên Vercel: đổi key ở Vercel → Settings → Environment Variables.";
const PRODUCTION_REASON =
  "Bản chạy production không cho sửa key từ giao diện (đặt TVS_ALLOW_CONFIG_EDIT=1 nếu đây là máy của bạn).";

export class ConfigController {
  constructor(private readonly options: ConfigControllerOptions) {}

  snapshot(): ConfigSnapshot {
    const { env } = this.options;
    const reason = this.readOnlyReason();
    return {
      editable: reason === null,
      readOnlyReason: reason,
      keys: CONFIG_KEYS.map((def) => {
        const value = env[def.key]?.trim() ?? "";
        const status: ConfigKeyStatus = { ...def, isSet: value !== "" };
        if (def.kind === "json" && value !== "") status.count = jsonCount(value);
        return status;
      }),
    };
  }

  async update(body: unknown): Promise<ConfigUpdateResult> {
    const reason = this.readOnlyReason();
    if (reason) throw new ValidationError(reason);

    const { set, clear } = parseBody(body);
    const toSet: Record<string, string> = {};
    for (const [key, raw] of Object.entries(set)) {
      const def = findConfigKey(key);
      if (!def) throw new ValidationError("Khoá cấu hình không được phép sửa");
      const value = raw.trim();
      if (value === "") continue;
      assertValidValue(def, value);
      toSet[key] = value;
    }
    for (const key of clear) {
      if (!findConfigKey(key)) throw new ValidationError("Khoá cấu hình không được phép sửa");
      if (key in set) throw new ValidationError(`${key}: không thể vừa đặt vừa xoá`);
    }

    const changed = [...Object.keys(toSet), ...clear.filter((k) => !(k in toSet))];
    let restartRequired = false;
    if (changed.length > 0) {
      await this.options.writer.apply({ set: toSet, clear });
      const { env } = this.options;
      for (const [key, value] of Object.entries(toSet)) env[key] = value;
      for (const key of clear) delete env[key];
      try {
        this.options.onApplied();
      } catch {
        restartRequired = true;
      }
    }
    return { ...this.snapshot(), changed, restartRequired };
  }

  private readOnlyReason(): string | null {
    const { env } = this.options;
    if (env.VERCEL) return VERCEL_REASON;
    if (env.NODE_ENV === "production" && env.TVS_ALLOW_CONFIG_EDIT !== "1") return PRODUCTION_REASON;
    return null;
  }
}

function jsonCount(value: string): number | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
}

function parseBody(body: unknown): { set: Record<string, string>; clear: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Yêu cầu cấu hình không hợp lệ");
  }
  const { set = {}, clear = [] } = body as { set?: unknown; clear?: unknown };
  if (typeof set !== "object" || set === null || Array.isArray(set)) throw new ValidationError("Trường set không hợp lệ");
  if (!Array.isArray(clear) || clear.some((k) => typeof k !== "string")) throw new ValidationError("Trường clear không hợp lệ");
  const values = Object.entries(set);
  if (values.some(([, v]) => typeof v !== "string")) throw new ValidationError("Giá trị cấu hình phải là chuỗi");
  return { set: Object.fromEntries(values) as Record<string, string>, clear: clear as string[] };
}
