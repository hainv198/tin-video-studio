"use client";

import { useEffect, useRef } from "react";
import { STEPS, canEnter, stepReady, type StepId } from "@/client/controllers/readiness";
import type { StudioData } from "@/client/controllers/StudioSession";

interface Props {
  current: StepId;
  data: StudioData;
  onSelect: (id: StepId) => void;
}

export function Stepper({ current, data, onSelect }: Props) {
  const list = useRef<HTMLOListElement>(null);

  // Điện thoại: các bước nằm trên một hàng cuộn ngang; cuộn ngang (chỉ ngang, không đụng cuộn trang) để bước đang mở luôn thấy.
  useEffect(() => {
    const ol = list.current;
    const active = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!ol || !active || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollLeft = active.offsetLeft - (ol.clientWidth - active.offsetWidth) / 2;
  }, [current]);

  return (
    <ol
      ref={list}
      className="relative -mx-4 flex gap-2 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {STEPS.map((step, index) => {
        const enabled = canEnter(step.id, data);
        const active = step.id === current;
        const done = (step.id === "news" || step.id === "voice") && stepReady(step.id, data);
        return (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              onClick={() => onSelect(step.id)}
              className={`min-h-11 rounded-full px-3 py-1.5 whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 ${
                active ? "bg-emerald-600 font-medium text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {index + 1}. {step.label}
              {done ? " ✓" : ""}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
