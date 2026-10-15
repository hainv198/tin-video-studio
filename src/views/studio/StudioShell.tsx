"use client";

import type { Studio } from "@/client/controllers/createStudio";
import { STEPS, canEnter, type StepId } from "@/client/controllers/readiness";
import { useController } from "@/views/hooks/useController";
import { Stepper } from "./Stepper";
import { StepFootage } from "./steps/StepFootage";
import { StepMusic } from "./steps/StepMusic";
import { StepNews } from "./steps/StepNews";
import { StepRender } from "./steps/StepRender";
import { StepVoice } from "./steps/StepVoice";

const BLOCKED_HINT: Partial<Record<StepId, string>> = {
  news: "Hãy chia cảnh từ tin của bạn trước.",
  voice: "Hãy tạo giọng cho mọi câu trước khi tiếp tục.",
};

function renderStep(step: StepId, studio: Studio) {
  switch (step) {
    case "news":
      return <StepNews studio={studio} />;
    case "voice":
      return <StepVoice studio={studio} />;
    case "footage":
      return <StepFootage studio={studio} />;
    case "music":
      return <StepMusic studio={studio} />;
    case "render":
      return <StepRender studio={studio} />;
  }
}

export function StudioShell({ studio }: { studio: Studio }) {
  const wizard = useController(studio.wizard);
  const data = useController(studio.session);
  const index = STEPS.findIndex((s) => s.id === wizard.step);
  const nextStep = STEPS[index + 1];
  const nextEnabled = nextStep ? canEnter(nextStep.id, data) : false;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {wizard.resume && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-800 p-4 text-sm">
          <span>
            Có bản nháp “{wizard.resume.title}” lưu lúc {new Date(wizard.resume.savedAt).toLocaleString("vi-VN")}.
          </span>
          <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium" onClick={() => void studio.wizard.resume()}>
            Mở lại
          </button>
          <button type="button" className="rounded-md bg-neutral-700 px-3 py-1.5" onClick={() => void studio.wizard.discard()}>
            Bỏ bản nháp
          </button>
        </div>
      )}
      <Stepper current={wizard.step} data={data} onSelect={(id) => studio.wizard.goTo(id)} />
      {wizard.error && (
        <p role="alert" className="text-red-400">
          {wizard.error}
        </p>
      )}
      <section>{renderStep(wizard.step, studio)}</section>
      <nav className="flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4">
        <button
          type="button"
          disabled={index === 0}
          className="rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-40"
          onClick={() => studio.wizard.back()}
        >
          Quay lại
        </button>
        {nextStep && (
          <button
            type="button"
            disabled={!nextEnabled}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-40"
            onClick={() => studio.wizard.next()}
          >
            Tiếp tục: {nextStep.label}
          </button>
        )}
        {nextStep && !nextEnabled && BLOCKED_HINT[wizard.step] && (
          <span className="text-sm text-neutral-400">{BLOCKED_HINT[wizard.step]}</span>
        )}
        <button
          type="button"
          className="ml-auto rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300"
          onClick={() => {
            if (window.confirm("Bắt đầu dự án mới? Dự án hiện tại, giọng đã tạo và file tải lên sẽ bị xoá.")) {
              void studio.wizard.newProject();
            }
          }}
        >
          Dự án mới
        </button>
      </nav>
    </div>
  );
}
