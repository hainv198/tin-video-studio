import { describe, expect, it, vi } from "vitest";
import { RenderJobBuilder } from "@/client/controllers/RenderJobBuilder";
import { EMPTY_STUDIO, type StudioData } from "@/client/controllers/StudioSession";
import { uploadToFootage } from "@/client/media/footageFactory";
import { trimSilence } from "@/client/media/audioTrim";
import { RenderCancelledError } from "@/client/render/errors";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { MusicTrack } from "@/domain/MusicTrack";
import { defaultTemplateRegistry } from "@/templates/registry";
import { fakeNarration, makeClip, makeProject, makeUploadProject, memoryUploads, VOICE } from "../../helpers/studioFixtures";

const SR = 48000;

/** 0,5 s lặng + 1 s âm + 0,5 s lặng. */
function voiceChannel(): Float32Array {
  const out = new Float32Array(SR * 2);
  for (let i = SR / 2; i < SR * 1.5; i++) out[i] = 0.5 * Math.sin(i / 20);
  return out;
}

function setup(overrides: Partial<{ sampleRate: number }> = {}) {
  const { uploads } = memoryUploads("u");
  const decode = vi.fn(async (_bytes: ArrayBuffer) => ({
    channels: [voiceChannel()],
    sampleRate: overrides.sampleRate ?? SR,
    durationSec: 2,
  }));
  const tracks = { bytes: vi.fn(async () => new Uint8Array([5, 5, 5]).buffer) };
  const builder = new RenderJobBuilder({
    templates: defaultTemplateRegistry(),
    uploads,
    tracks,
    decoder: { decode },
    origin: "http://localhost:3100",
  });
  const project = makeProject(2); // s1 mở đầu, s2, s3
  const data: StudioData = {
    ...EMPTY_STUDIO,
    project,
    voice: VOICE,
    narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])),
    brand: { values: { channelName: "KÊNH" }, logo: new Blob(["png"]) },
  };
  return { builder, data, uploads, tracks, decode, project };
}

describe("RenderJobBuilder", () => {
  it("dựng job: cảnh theo thứ tự, giọng đã cắt lặng, thương hiệu và thông tin dự án", async () => {
    const { builder, data } = setup();
    const { job, warnings } = await builder.build(data);
    expect(warnings).toEqual([]);
    expect(job.scenes.map((s) => [s.sceneId, s.role])).toEqual([
      ["s1", "intro"],
      ["s2", "body"],
      ["s3", "body"],
    ]);
    expect(job.sampleRate).toBe(48000);
    expect(job.origin).toBe("http://localhost:3100");
    expect(job.templateId).toBe("theanh28");
    expect(job.brandValues).toEqual({ channelName: "KÊNH" });
    expect(job.logo).toBe(data.brand.logo);
    expect(job.project).toEqual({ displayTitle: "Tiêu đề bản tin", sourceCredit: "Nguồn thử", publishDateText: "14/10/2026" });
    const n = job.narrations[0]!;
    expect(n.durationSec).toBeCloseTo(n.samples.length / SR, 10);
    expect(n.durationSec).toBeGreaterThan(1.0);
    expect(n.durationSec).toBeLessThan(1.2); // 1 s âm + 2 × 0,04 s đệm, không còn 2 s gốc
    expect(job.music).toBeNull();
  });

  it("cảnh trám: stock dùng url, tải lên dùng blob, thiếu dùng nền mặc định", async () => {
    const { builder, data, uploads, project } = setup();
    const meta = await uploads.put(new Blob(["jpg"]), { name: "a.jpg", kind: "image" });
    const stock = new ImageFootage("g1", { origin: "pexels", uri: "https://cdn/x.jpg" }, 100, 100);
    const own = uploadToFootage("g2", meta.id, "image", { width: 100, height: 100 });
    const lost = uploadToFootage("g3", "upload-khong-co", "image", { width: 100, height: 100 });
    const withFootage = {
      ...data,
      footage: data.footage.assign("s1", stock).assign("s2", own).assign("s3", lost),
    };
    const { job, warnings } = await builder.build(withFootage);
    expect(job.scenes[0]!.footage).toEqual({ kind: "image", url: "https://cdn/x.jpg" });
    expect(job.scenes[1]!.footage.kind).toBe("image");
    expect(job.scenes[1]!.footage.blob).toBeInstanceOf(Blob);
    expect(job.scenes[2]!.footage).toEqual({ kind: "fallback" });
    expect(warnings).toEqual(["Không tìm thấy file tải lên của cảnh 3, dùng nền mặc định"]);
    expect(project.scenes).toHaveLength(3);
  });

  it("đoạn dùng tiếp: không nạp cảnh riêng (kể cả đang giữ), trỏ footageFrom về chủ cảnh; mặc định không có footageFrom", async () => {
    const { builder, data } = setup();
    const stock = new ImageFootage("g1", { origin: "pexels", uri: "https://cdn/x.jpg" }, 100, 100);
    const lost = uploadToFootage("g3", "upload-khong-co", "image", { width: 100, height: 100 });
    const base = { ...data, footage: data.footage.assign("s2", stock).assign("s3", lost) };
    const plain = await builder.build({ ...base, footage: base.footage.unassign("s3") });
    expect(plain.job.scenes.every((s) => !("footageFrom" in s))).toBe(true);
    const { job, warnings } = await builder.build({ ...base, options: base.options.withSceneContinued("s3", true) });
    expect(warnings).toEqual([]);
    expect(job.scenes[1]).not.toHaveProperty("footageFrom");
    expect(job.scenes[2]).toMatchObject({ sceneId: "s3", footage: { kind: "fallback" }, footageFrom: "s2" });
  });

  it("cảnh chưa gán cảnh trám dùng nền mặc định, không cảnh báo", async () => {
    const { builder, data } = setup();
    const { job, warnings } = await builder.build({ ...data, footage: data.footage.assign("s2", new FallbackFootage("x")) });
    expect(job.scenes.every((s) => s.footage.kind === "fallback")).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("nhạc: nạp qua TrackSource, mức theo MusicTrack; lỗi nạp thì dựng không nhạc và cảnh báo", async () => {
    const { builder, data, tracks } = setup();
    const music = MusicTrack.create({ id: "m", title: "M", origin: "library", uri: "/music/m.mp3", gainOffsetDb: 2 });
    const ok = await builder.build({ ...data, music });
    expect(ok.job.music?.levelBelowVoiceDb).toBe(13);
    expect(ok.job.music?.channels).toHaveLength(1);

    tracks.bytes.mockRejectedValueOnce(new Error("hỏng mạng"));
    const failed = await builder.build({ ...data, music });
    expect(failed.job.music).toBeNull();
    expect(failed.warnings).toEqual(["Không nạp được nhạc nền, video sẽ dựng không có nhạc"]);
  });

  it("thiếu dự án, giọng cũ hoặc thiếu giọng thì báo bằng tiếng Việt", async () => {
    const { builder, data } = setup();
    await expect(builder.build(EMPTY_STUDIO)).rejects.toThrow("Chưa có dự án");
    const partial = { ...data, narrations: new Map([...data.narrations].slice(1)) };
    await expect(builder.build(partial)).rejects.toThrow("Chưa đủ giọng đọc cho mọi cảnh");
  });

  it("giải mã sai tần số mẫu thì báo lỗi rõ ràng", async () => {
    const { builder, data } = setup({ sampleRate: 44100 });
    await expect(builder.build(data)).rejects.toThrow("Âm thanh giải mã sai tần số mẫu (44100 Hz thay vì 48000 Hz)");
  });

  it("huỷ giữa chừng thì ném RenderCancelledError", async () => {
    const { builder, data } = setup();
    await expect(builder.build(data, undefined, () => true)).rejects.toBeInstanceOf(RenderCancelledError);
  });

  it("báo tiến độ theo từng cảnh", async () => {
    const { builder, data } = setup();
    const labels: string[] = [];
    await builder.build(data, (label) => labels.push(label));
    expect(labels).toEqual(["Chuẩn bị giọng đọc 1/3", "Chuẩn bị giọng đọc 2/3", "Chuẩn bị giọng đọc 3/3"]);
  });
});

describe("RenderJobBuilder — bitrate", () => {
  it("không đặt thì job không có videoBitrate; đặt thì truyền vào job", async () => {
    const { builder, data } = setup();
    expect((await builder.build(data)).job.videoBitrate).toBeUndefined();
    const light = new RenderJobBuilder({
      templates: defaultTemplateRegistry(),
      uploads: memoryUploads("u").uploads,
      tracks: { bytes: async () => new ArrayBuffer(0) },
      decoder: { decode: async () => ({ channels: [new Float32Array(48000)], sampleRate: 48000, durationSec: 1 }) },
      origin: "http://localhost:3100",
      videoBitrate: 5_000_000,
    });
    expect((await light.build(data)).job.videoBitrate).toBe(5_000_000);
  });

  it("tuỳ chọn của lượt dựng ghi đè bitrate mặc định của deps", async () => {
    const { builder, data } = setup();
    expect((await builder.build(data, undefined, undefined, { videoBitrate: 5_000_000 })).job.videoBitrate).toBe(5_000_000);
    expect((await builder.build(data, undefined, undefined, {})).job.videoBitrate).toBeUndefined();
    const heavy = new RenderJobBuilder({
      templates: defaultTemplateRegistry(),
      uploads: memoryUploads("u").uploads,
      tracks: { bytes: async () => new ArrayBuffer(0) },
      decoder: { decode: async () => ({ channels: [new Float32Array(48000)], sampleRate: 48000, durationSec: 1 }) },
      origin: "http://localhost:3100",
      videoBitrate: 8_000_000,
    });
    expect((await heavy.build(data, undefined, undefined, { videoBitrate: 5_000_000 })).job.videoBitrate).toBe(5_000_000);
    expect((await heavy.build(data)).job.videoBitrate).toBe(8_000_000);
  });
  it("job kèm tuỳ chọn video của dự án (dữ liệu thuần, structuredClone được)", async () => {
    const { builder, data } = setup();
    const options = data.options.withSubtitlesEnabled(false).withTextFont("oswald").withIntroBlock("#C0392B");
    const { job } = await builder.build({ ...data, options });
    expect(job.options).toEqual(options.snapshot());
    expect(structuredClone(job.options)).toEqual(options.snapshot());
  });

  it("job mang nhịp đọc của video (gapSec/leadInSec) để worker dựng timeline", async () => {
    const { builder, data } = setup();
    const options = data.options.withGapSec(0.8).withLeadInSec(0.4);
    const { job } = await builder.build({ ...data, options });
    expect(job.options.pacing).toEqual({ gapSec: 0.8, leadInSec: 0.4 });
  });

  it("tinh chỉnh tempo 1,25: giọng xử lý sau khi cắt lặng, durationSec ≈ /1,25 và job mang mẫu đã xử lý", async () => {
    const { builder, data } = setup();
    const plain = (await builder.build(data)).job.narrations[0]!;
    const options = data.options.withTempo(1.25);
    const { job } = await builder.build({ ...data, options });
    const n = job.narrations[0]!;
    expect(n.samples).not.toBe(plain.samples);
    expect(n.samples.length).toBeLessThan(plain.samples.length);
    expect(n.durationSec).toBeCloseTo(n.samples.length / SR, 10);
    expect(Math.abs(n.durationSec - plain.durationSec / 1.25) / (plain.durationSec / 1.25)).toBeLessThan(0.02);
    expect(job.options.voiceTweak).toEqual({ tempo: 1.25, pitchSemitones: 0 });
  });

  it("đổi tông (giữ tốc độ): độ dài giữ nguyên, mẫu khác bản gốc", async () => {
    const { builder, data } = setup();
    const plain = (await builder.build(data)).job.narrations[0]!;
    const { job } = await builder.build({ ...data, options: data.options.withPitchSemitones(3) });
    const n = job.narrations[0]!;
    expect(Math.abs(n.samples.length - plain.samples.length) / plain.samples.length).toBeLessThan(0.02);
    expect(Array.from(n.samples.subarray(2000, 2100))).not.toEqual(Array.from(plain.samples.subarray(2000, 2100)));
  });

  it("tinh chỉnh mặc định: mẫu và độ dài y hệt cũ (chỉ cắt lặng)", async () => {
    const { builder, data } = setup();
    const { job } = await builder.build(data);
    const n = job.narrations[0]!;
    const expected = trimSilence(voiceChannel(), SR).samples;
    expect(n.durationSec).toBe(expected.length / SR);
    expect(Array.from(n.samples)).toEqual(Array.from(expected));
  });
});

describe("RenderJobBuilder — kiểu Video tải lên", () => {
  async function uploadSetup(clipOver: Parameters<typeof makeClip>[0] = {}) {
    const base = setup();
    const project = makeUploadProject();
    const meta = await base.uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const data: StudioData = {
      ...EMPTY_STUDIO,
      kind: "upload",
      project,
      voice: VOICE,
      narrations: new Map([[project.introScene.id, fakeNarration(project.introScene)]]),
      brand: base.data.brand,
      sourceClip: makeClip({ uploadId: meta.id, volumePercent: 80, ...clipOver }),
    };
    return { ...base, data, project, meta };
  }

  it("job: một cảnh mở đầu + khối sourceClip; không phụ đề; credit VIDEO", async () => {
    const { builder, data } = await uploadSetup();
    const { job, warnings } = await builder.build(data);
    expect(warnings).toEqual([]);
    expect(job.scenes).toEqual([{ sceneId: "s1", role: "intro", text: "Tiêu đề video tải lên", footage: { kind: "fallback" } }]);
    expect(job.narrations).toHaveLength(1);
    expect(job.project).toEqual({
      displayTitle: "Tiêu đề video tải lên",
      sourceCredit: "Nguồn thử",
      publishDateText: "14/10/2026",
      mediaCredit: "VIDEO: TỔNG HỢP",
    });
    expect(job.options.subtitles.enabled).toBe(false);
    expect(job.sourceClip).toMatchObject({ durationSec: 8, hasAudio: true, gain: 0.8, thumbnailSec: 1 });
    expect(job.sourceClip?.blob).toBeInstanceOf(Blob);
  });

  it("video không có tiếng gốc: hệ số 0 và cảnh báo", async () => {
    const { builder, data } = await uploadSetup({ hasAudio: false });
    const { job, warnings } = await builder.build(data);
    expect(job.sourceClip?.gain).toBe(0);
    expect(warnings).toEqual(["Video tải lên không có tiếng gốc"]);
  });

  it("chưa tải video hoặc mất blob thì báo lỗi rõ", async () => {
    const { builder, data } = await uploadSetup();
    await expect(builder.build({ ...data, sourceClip: null })).rejects.toThrow("Chưa tải video lên");
    await expect(builder.build({ ...data, sourceClip: makeClip({ uploadId: "upload-mat" }) })).rejects.toThrow(
      "Không tìm thấy video đã tải lên, hãy tải lại ở bước Video của bạn",
    );
  });

  it("kiểu tin: job không có sourceClip, project không có mediaCredit", async () => {
    const { builder, data } = setup();
    const { job } = await builder.build(data);
    expect("sourceClip" in job).toBe(false);
    expect("mediaCredit" in job.project).toBe(false);
  });
});

describe("RenderJobBuilder — banner chân", () => {
  it("phong cách banner + banner riêng: job mang banner (cả kiểu tin và kiểu tải lên)", async () => {
    const { builder, data, uploads } = setup();
    const banner = new Blob(["banner"]);
    const project = data.project!.withMeta({ templateId: "theanh28-banner" });
    const { job } = await builder.build({ ...data, project, brand: { ...data.brand, banner } });
    expect(job.templateId).toBe("theanh28-banner");
    expect(job.banner).toBe(banner);

    const upload = makeUploadProject().withMeta({ templateId: "theanh28-banner" });
    const meta = await uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const built = await builder.build({
      ...EMPTY_STUDIO,
      kind: "upload",
      project: upload,
      voice: VOICE,
      narrations: new Map([[upload.introScene.id, fakeNarration(upload.introScene)]]),
      brand: { values: {}, logo: null, banner },
      sourceClip: makeClip({ uploadId: meta.id }),
    });
    expect(built.job.banner).toBe(banner);
  });

  it("phong cách banner chưa có banner riêng, hoặc phong cách cũ: job không có khoá banner", async () => {
    const { builder, data } = setup();
    const project = data.project!.withMeta({ templateId: "theanh28-banner" });
    expect("banner" in (await builder.build({ ...data, project })).job).toBe(false);
    expect("banner" in (await builder.build({ ...data, brand: { ...data.brand, banner: new Blob(["x"]) } })).job).toBe(false);
  });
});

describe("RenderJobBuilder — đọc tiêu đề đè trên video", () => {
  async function overlaySetup(clipSec = 8) {
    const base = setup();
    const project = makeUploadProject();
    const meta = await base.uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const data: StudioData = {
      ...EMPTY_STUDIO,
      kind: "upload",
      project,
      voice: VOICE,
      narrations: new Map([[project.introScene.id, fakeNarration(project.introScene)]]),
      brand: base.data.brand,
      sourceClip: makeClip({ uploadId: meta.id, durationSec: clipSec }),
      options: EMPTY_STUDIO.options.withUploadComposition("title-over-clip"),
    };
    return { ...base, data };
  }

  it("job mang composition 'title-over-clip'; vẫn một cảnh tiêu đề + giọng; không phụ đề", async () => {
    const { builder, data } = await overlaySetup();
    const { job } = await builder.build(data);
    expect(job.sourceClip?.composition).toBe("title-over-clip");
    expect(job.options.uploadComposition).toBe("title-over-clip");
    expect(job.scenes.map((s) => s.role)).toEqual(["intro"]);
    expect(job.narrations).toHaveLength(1);
    expect(job.options.subtitles.enabled).toBe(false);
  });

  it("cách ghép mặc định: sourceClip không có khoá composition (job như cũ)", async () => {
    const { builder, data } = await overlaySetup();
    const { job } = await builder.build({ ...data, options: EMPTY_STUDIO.options });
    expect("composition" in (job.sourceClip ?? {})).toBe(false);
  });

  it("giọng (đã cắt lặng ≈ 1,08 s) + nghỉ đầu 0,3 s dài hơn video 1 s: báo lỗi tiếng Việt ở bước Dựng", async () => {
    const { builder, data } = await overlaySetup(1);
    await expect(builder.build(data)).rejects.toThrow(/^Giọng đọc tiêu đề \(kể cả nghỉ đầu\) dài 1,4 giây, video chỉ 1,0 giây\./);
  });
});
