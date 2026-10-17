"use client";

import type { Studio } from "@/client/controllers/createStudio";
import { STEPS, canEnter, type StepId } from "@/client/controllers/readiness";
import { ConfirmButton } from "@/views/components/ConfirmButton";
import { useController } from "@/views/hooks/useController";
import { OptionsSidebar } from "./components/OptionsSidebar";
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

function newProjectButton(studio: Studio) {
  return (
    <ConfirmButton
      label="Dự án mới"
      prompt="Bắt đầu dự án mới? Dự án hiện tại, giọng đã tạo và file tải lên sẽ bị xoá."
      confirmAriaLabel="Xác nhận bắt đầu dự án mới"
      className="min-h-11 rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 lg:min-h-0"
      onConfirm={() => studio.wizard.newProject()}
    />
  );
}

export function StudioShell({ studio }: { studio: Studio }) {
  const wizard = useController(studio.wizard);
  const data = useController(studio.session);
  const index = STEPS.findIndex((s) => s.id === wizard.step);
  const nextStep = STEPS[index + 1];
  const nextEnabled = nextStep ? canEnter(nextStep.id, data) : false;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <OptionsSidebar studio={studio} />
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        {wizard.resume && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-800 p-4 text-sm">
            <span>
              Có bản nháp “{wizard.resume.title}” lưu lúc {new Date(wizard.resume.savedAt).toLocaleString("vi-VN")}.
            </span>
            <button type="button" className="min-h-11 rounded-md bg-emerald-600 px-3 py-1.5 font-medium sm:min-h-0" onClick={() => void studio.wizard.resume()}>
              Mở lại
            </button>
            <button type="button" className="min-h-11 rounded-md bg-neutral-700 px-3 py-1.5 sm:min-h-0" onClick={() => void studio.wizard.discard()}>
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
        {/* Điện thoại: "Dự án mới" nằm cuối nội dung, ngoài thanh dính đáy để khỏi chạm nhầm. */}
        <div className="flex justify-end lg:hidden">{newProjectButton(studio)}</div>
        <nav
          aria-label="Điều hướng bước"
          className="sticky bottom-0 z-30 -mx-4 flex flex-col gap-2 border-t border-neutral-800 bg-neutral-950 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 lg:bg-transparent lg:px-0 lg:pt-4 lg:pb-0"
        >
          <div className="flex gap-2 lg:gap-3">
            <button
              type="button"
              disabled={index === 0}
              className="min-h-11 shrink-0 rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-40 lg:min-h-0"
              onClick={() => studio.wizard.back()}
            >
              Quay lại
            </button>
            {nextStep && (
              <button
                type="button"
                disabled={!nextEnabled}
                className="min-h-11 min-w-0 flex-1 truncate rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-40 lg:min-h-0 lg:flex-none"
                onClick={() => studio.wizard.next()}
              >
                Tiếp tục: {nextStep.label}
              </button>
            )}
          </div>
          {nextStep && !nextEnabled && BLOCKED_HINT[wizard.step] && (
            <span className="order-first text-sm text-neutral-400 lg:order-none">{BLOCKED_HINT[wizard.step]}</span>
          )}
          <span className="ml-auto hidden lg:inline">{newProjectButton(studio)}</span>
        </nav>
      </div>
    </div>
  );
}
