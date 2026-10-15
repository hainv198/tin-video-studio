"use client";

import { STEPS, canEnter, stepReady, type StepId } from "@/client/controllers/readiness";
import type { StudioData } from "@/client/controllers/StudioSession";

interface Props {
  current: StepId;
  data: StudioData;
  onSelect: (id: StepId) => void;
}

export function Stepper({ current, data, onSelect }: Props) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((step, index) => {
        const enabled = canEnter(step.id, data);
        const active = step.id === current;
        const done = (step.id === "news" || step.id === "voice") && stepReady(step.id, data);
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              onClick={() => onSelect(step.id)}
              className={`rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
