import { describe, expect, it, vi } from "vitest";
import { RenderJobBuilder } from "@/client/controllers/RenderJobBuilder";
import { EMPTY_STUDIO, type StudioData } from "@/client/controllers/StudioSession";
import { uploadToFootage } from "@/client/media/footageFactory";
import { RenderCancelledError } from "@/client/render/errors";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { MusicTrack } from "@/domain/MusicTrack";
import { defaultTemplateRegistry } from "@/templates/registry";
import { fakeNarration, makeProject, memoryUploads, VOICE } from "../../helpers/studioFixtures";

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
});
