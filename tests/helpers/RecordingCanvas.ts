import type { Canvas2D } from "@/templates/Canvas2D";

export interface DrawCall {
  op: string;
  args: unknown[];
  state: { fillStyle: unknown; font: string; globalAlpha: number; filter: string; imageSmoothingEnabled: boolean; imageSmoothingQuality: string };
}

class RecordedGradient {
  readonly stops: [number, string][] = [];
  addColorStop(o: number, c: string): void {
    this.stops.push([o, c]);
  }
}

/** Context 2D giả: ghi lại mọi lệnh vẽ để test trên Node. measureText = số ký tự × cỡ chữ × 0.5. */
export class RecordingCanvas {
  readonly calls: DrawCall[] = [];
  fillStyle: unknown = "#000000";
  strokeStyle: unknown = "#000000";
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  globalAlpha = 1;
  filter = "none";
  lineWidth = 1;
  lineJoin: CanvasLineJoin = "miter";
  shadowColor = "rgba(0, 0, 0, 0)";
  shadowBlur = 0;
  shadowOffsetY = 0;
  letterSpacing = "0px";
  imageSmoothingEnabled = true;
  imageSmoothingQuality: "low" | "medium" | "high" = "low";

  private record(op: string, args: unknown[]): void {
    this.calls.push({
      op,
      args,
      state: {
        fillStyle: this.fillStyle,
        font: this.font,
        globalAlpha: this.globalAlpha,
        filter: this.filter,
        imageSmoothingEnabled: this.imageSmoothingEnabled,
        imageSmoothingQuality: this.imageSmoothingQuality,
      },
    });
  }

  save(): void { this.record("save", []); }
  restore(): void { this.record("restore", []); }
  fillRect(...args: unknown[]): void { this.record("fillRect", args); }
  drawImage(...args: unknown[]): void { this.record("drawImage", args); }
  fillText(...args: unknown[]): void { this.record("fillText", args); }
  strokeText(...args: unknown[]): void { this.record("strokeText", args); }
  beginPath(): void { this.record("beginPath", []); }
  rect(...args: unknown[]): void { this.record("rect", args); }
  roundRect(...args: unknown[]): void { this.record("roundRect", args); }
  arc(...args: unknown[]): void { this.record("arc", args); }
  fill(): void { this.record("fill", []); }
  stroke(): void { this.record("stroke", []); }
  clip(): void { this.record("clip", []); }

  measureText(text: string): { width: number } {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * px * 0.5 };
  }

  createLinearGradient(...args: unknown[]): RecordedGradient {
    // addColorStop nằm trên prototype: hai lần vẽ giống nhau cho gradient bằng nhau khi so toEqual.
    const gradient = new RecordedGradient();
    this.record("createLinearGradient", args);
    return gradient;
  }

  asCanvas(): Canvas2D {
    return this as unknown as Canvas2D;
  }

  texts(): string[] {
    return this.calls.filter((c) => c.op === "fillText").map((c) => String(c.args[0]));
  }

  ops(name: string): DrawCall[] {
    return this.calls.filter((c) => c.op === name);
  }
}
