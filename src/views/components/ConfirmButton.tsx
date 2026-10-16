"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ConfirmGate } from "@/views/hooks/ConfirmGate";

interface Props {
  label: string;
  /** Dòng cảnh báo nhỏ hiện cạnh nút khi chờ xác nhận. */
  prompt: string;
  /** Mô tả cho trình đọc màn hình, vd. "Xác nhận xoá tài khoản hai". */
  confirmAriaLabel: string;
  className: string;
  disabled?: boolean;
  title?: string;
  onConfirm: () => unknown;
}

const CANCEL_CLASS = "rounded-md bg-neutral-800 px-3 py-1.5 text-sm disabled:opacity-50";

/** Nút hai bước thay cho window.confirm: bấm lần đầu hiện "Xác nhận / Huỷ" tại chỗ. */
export function ConfirmButton({ label, prompt, confirmAriaLabel, className, disabled, title, onConfirm }: Props) {
  const [gate] = useState(() => new ConfirmGate());
  const armed = useSyncExternalStore(gate.subscribe, gate.getSnapshot, () => false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => gate.dispose(), [gate]);
  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  if (!armed) {
    return (
      <button type="button" className={className} disabled={disabled} title={title} onClick={() => gate.arm()}>
        {label}
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-label={confirmAriaLabel}
      className="inline-flex flex-wrap items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") gate.cancel();
      }}
    >
      <span className="text-xs text-amber-400">{prompt}</span>
      <button
        ref={confirmRef}
        type="button"
        className={className}
        disabled={disabled}
        aria-label={confirmAriaLabel}
        onClick={() => {
          if (gate.confirm()) void onConfirm();
        }}
      >
        Xác nhận
      </button>
      <button type="button" className={CANCEL_CLASS} onClick={() => gate.cancel()}>
        Huỷ
      </button>
    </span>
  );
}
