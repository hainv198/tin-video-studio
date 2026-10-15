"use client";

import { useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { toDateInput } from "@/client/controllers/dateText";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { useController } from "@/views/hooks/useController";
import { BrandPanel } from "../components/BrandPanel";

export function StepNews({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const projectState = useController(studio.project);
  const templates = studio.services.templates.list();
  const project = data.project;

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [credit, setCredit] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Nhập tin</h2>
        <label className="flex flex-col gap-1 text-sm">
          Nội dung tin (dán vào đây)
          <textarea
            className="min-h-48 rounded-md bg-neutral-800 px-3 py-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mỗi câu sẽ thành một cảnh."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tiêu đề (để trống thì lấy câu đầu tiên)
          <input className="rounded-md bg-neutral-800 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Theo: nguồn tin (tối đa 80 ký tự)
            <input
              className="rounded-md bg-neutral-800 px-3 py-2"
              value={credit}
              maxLength={80}
              onChange={(e) => setCredit(e.target.value)}
              placeholder="Đức Phong - VietNamNet"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ngày đăng
            <input type="date" className="rounded-md bg-neutral-800 px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Phong cách video
          <select className="rounded-md bg-neutral-800 px-3 py-2" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {templateId && <BrandPanel studio={studio} templateId={templateId} />}
        {projectState.error && (
          <p role="alert" className="text-red-400">
            {projectState.error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium"
            onClick={() => studio.project.createFromForm({ text, title, sourceCredit: credit, publishDateText: date, templateId })}
          >
            Chia cảnh
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-800 px-4 py-2"
            onClick={() => {
              setText(SAMPLE_NEWS.text);
              setCredit(SAMPLE_NEWS.sourceCredit);
              setDate(toDateInput(SAMPLE_NEWS.publishDate));
            }}
          >
            Điền tin mẫu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Các cảnh ({project.scenes.length})</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Theo: nguồn tin
          <input
            className="rounded-md bg-neutral-800 px-3 py-2"
            defaultValue={project.sourceCredit}
            maxLength={80}
            onBlur={(e) => studio.project.updateMetaFromForm({ sourceCredit: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ngày đăng
          <input
            type="date"
            className="rounded-md bg-neutral-800 px-3 py-2"
            defaultValue={toDateInput(project.publishDate)}
            onChange={(e) => studio.project.updateMetaFromForm({ publishDateText: e.target.value })}
          />
        </label>
      </div>
      <BrandPanel studio={studio} templateId={project.templateId} />
      {projectState.error && (
        <p role="alert" className="text-red-400">
          {projectState.error}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {project.scenes.map((scene, index) => (
          <li key={`${scene.id}:${scene.text}`} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{scene.role === "intro" ? "Cảnh mở đầu (tiêu đề)" : `Cảnh ${index}`}</span>
              <span>{scene.text.length} ký tự</span>
            </div>
            <textarea
              ref={(el) => {
                textareas.current[scene.id] = el;
              }}
              className="min-h-16 rounded-md bg-neutral-800 px-3 py-2 text-sm"
              defaultValue={scene.text}
              onBlur={(e) => {
                if (e.target.value !== scene.text) studio.project.updateSceneText(scene.id, e.target.value);
              }}
            />
            {scene.role === "body" && (
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-md bg-neutral-800 px-3 py-1"
                  disabled={index === project.scenes.length - 1}
                  onClick={() => studio.project.mergeWithNext(scene.id)}
                >
                  Gộp với câu sau
                </button>
                <button
                  type="button"
                  className="rounded-md bg-neutral-800 px-3 py-1"
                  onClick={() => studio.project.splitScene(scene.id, textareas.current[scene.id]?.selectionStart ?? 0)}
                >
                  Tách tại con trỏ
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
