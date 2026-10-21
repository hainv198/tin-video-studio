import { fromDateInput } from "@/client/controllers/dateText";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { BrandKit } from "@/domain/BrandKit";
import { NewsProject } from "@/domain/NewsProject";
import { MEDIA_CREDIT, type ProjectKind } from "@/domain/ProjectKind";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";
import { frameStyleFor } from "@/templates/fonts/FontCatalog";
import { SOURCE_CLIP_MEDIA, sourceClipMediaFor, type DrawableImage, type ProjectFrame, type SceneFrame, type VideoTemplate } from "@/templates/VideoTemplate";

export type PreviewTab = "intro" | "body";

/** Dữ liệu biểu mẫu bước 1 chưa bấm "Chia cảnh" (giống đầu vào của ProjectController.createFromForm). */
export interface PreviewForm {
  text: string;
  title: string;
  sourceCredit: string;
  /** yyyy-mm-dd như <input type="date">. */
  publishDateText: string;
  templateId: string;
  /** Bỏ trống = "news". */
  kind?: ProjectKind;
}

export interface PreviewInput {
  form: PreviewForm;
  template: Pick<VideoTemplate, "id" | "brandFields">;
  /** Giá trị thương hiệu hiện tại (session nhận ngay khi sửa, chưa cần "Lưu thương hiệu"). */
  brandValues: Record<string, string>;
  options: VideoOptionsSnapshot;
  logo: DrawableImage | null;
  /** Ảnh minh hoạ thay cảnh trám (bước 1 chưa có cảnh trám). */
  image: DrawableImage | null;
  now?: Date;
}

export interface PreviewFrames {
  project: ProjectFrame;
  intro: SceneFrame;
  body: SceneFrame;
  usingSample: boolean;
}

/** Ước lượng tốc độ đọc để có độ dài giọng giả (chưa tạo giọng ở bước 1). */
export const PREVIEW_CHARS_PER_SEC = 15;

const pad2 = (n: number) => String(n).padStart(2, "0");
const dateText = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const voiceSecFor = (text: string) => Math.max(1, text.length / PREVIEW_CHARS_PER_SEC);

function brandKit(template: PreviewInput["template"], values: Record<string, string>): BrandKit {
  try {
    return BrandKit.create(template.id, template.brandFields, values);
  } catch {
    return BrandKit.create(template.id, template.brandFields, {});
  }
}

/** Tiêu đề và câu thân bài đầu tiên đúng như khi "Chia cảnh" (dùng NewsProject.fromText). */
function splitNews(text: string, title: string, templateId: string, splitter: SentenceSplitter) {
  try {
    let n = 0;
    const project = NewsProject.fromText(
      { text, title, sourceCredit: "", publishDate: new Date(), templateId: templateId || "preview" },
      splitter,
      () => `p${++n}`,
    );
    return { introText: project.introScene.text, displayTitle: project.displayTitle, bodyText: project.bodyScenes[0]?.text ?? "" };
  } catch {
    // Chỉ có một câu (tin chưa chia được): thân bài dùng lại câu tiêu đề.
    const introText = title.replace(/\s+/g, " ").trim() || (splitter.split(text)[0] ?? "");
    // Cùng quy tắc NewsProject.displayTitle.
    return { introText, displayTitle: introText.replace(/[.!?…]+$/u, "").trim(), bodyText: introText };
  }
}

function previewDate(form: PreviewForm, usingSample: boolean, now: Date | undefined): Date {
  try {
    return fromDateInput(form.publishDateText);
  } catch {
    return usingSample ? SAMPLE_NEWS.publishDate : (now ?? new Date());
  }
}

/** Kiểu "Video tải lên": thẻ đầu với tiêu đề; thân bài là khung video vừa khung, không chữ, không phụ đề. */
function buildUploadFrames(input: PreviewInput, splitter: SentenceSplitter): PreviewFrames {
  const { form, template, options } = input;
  const typed = form.title.replace(/\s+/g, " ").trim();
  const usingSample = typed === "";
  const introText = typed || (splitter.split(SAMPLE_NEWS.text)[0] ?? "Tiêu đề video");
  const publishDate = previewDate(form, usingSample, input.now);
  const credit = form.sourceCredit.trim() || (usingSample ? SAMPLE_NEWS.sourceCredit : "");
  const style = frameStyleFor(options);
  const project: ProjectFrame = {
    displayTitle: introText.replace(/[.!?…]+$/u, "").trim(),
    sourceCredit: credit,
    publishDateText: dateText(publishDate),
    brand: brandKit(template, input.brandValues),
    logo: input.logo,
    style: { ...style, subtitles: { ...style.subtitles, enabled: false } },
    mediaCredit: MEDIA_CREDIT.upload,
  };
  const { leadInSec, gapSec } = options.pacing;
  const introVoice = voiceSecFor(introText);
  const introDuration = leadInSec + introVoice + gapSec;
  const intro: SceneFrame = {
    role: "intro",
    text: introText,
    image: input.image,
    sceneTime: 0,
    sceneDuration: introDuration,
    footageTime: 0,
    footageDuration: introDuration,
    voiceStart: leadInSec,
    voiceDuration: introVoice,
  };
  const body: SceneFrame = {
    role: "body",
    text: "",
    image: input.image,
    sceneTime: 0,
    sceneDuration: 1,
    footageTime: 0,
    footageDuration: 1,
    voiceStart: 0,
    voiceDuration: 0,
    media: input.image ? sourceClipMediaFor(input.image.width, input.image.height) : SOURCE_CLIP_MEDIA,
  };
  return { project, intro, body, usingSample };
}

/** Dựng ProjectFrame + hai SceneFrame (khung đầu của cảnh mở đầu, giữa câu thân bài đầu) cho xem trước bước 1. */
export function buildPreviewFrames(input: PreviewInput, splitter = new SentenceSplitter()): PreviewFrames {
  if (input.form.kind === "upload") return buildUploadFrames(input, splitter);
  const { form, template, options } = input;
  const usingSample = splitter.split(form.text).length === 0;
  const text = usingSample ? SAMPLE_NEWS.text : form.text;
  const news = splitNews(text, form.title, form.templateId, splitter);

  const publishDate = previewDate(form, usingSample, input.now);
  const credit = form.sourceCredit.trim() || (usingSample ? SAMPLE_NEWS.sourceCredit : "");

  const project: ProjectFrame = {
    displayTitle: news.displayTitle,
    sourceCredit: credit,
    publishDateText: dateText(publishDate),
    brand: brandKit(template, input.brandValues),
    logo: input.logo,
    style: frameStyleFor(options),
  };

  const { leadInSec, gapSec } = options.pacing;
  const introVoice = voiceSecFor(news.introText);
  const introDuration = leadInSec + introVoice + gapSec;
  const intro: SceneFrame = {
    role: "intro",
    text: news.introText,
    image: input.image,
    sceneTime: 0,
    sceneDuration: introDuration,
    footageTime: 0,
    footageDuration: introDuration,
    voiceStart: leadInSec,
    voiceDuration: introVoice,
  };
  const bodyVoice = voiceSecFor(news.bodyText);
  const bodyDuration = bodyVoice + gapSec;
  const body: SceneFrame = {
    role: "body",
    text: news.bodyText,
    image: input.image,
    sceneTime: bodyVoice / 2,
    sceneDuration: bodyDuration,
    footageTime: bodyVoice / 2,
    footageDuration: bodyDuration,
    voiceStart: 0,
    voiceDuration: bodyVoice,
  };
  return { project, intro, body, usingSample };
}
