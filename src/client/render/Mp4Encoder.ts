import { AudioSample, AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output } from "mediabunny";
import type { StereoMix } from "@/client/media/AudioMix";
import type { VideoFrameSink } from "./VideoRenderer";

export interface Mp4EncoderOptions {
  canvas: OffscreenCanvas;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
}

const AUDIO_CHUNK_SEC = 1;

export class Mp4Encoder implements VideoFrameSink {
  private readonly target = new BufferTarget();
  private readonly output: Output;
  private readonly video: CanvasSource;
  private readonly audio: AudioSampleSource;

  constructor(options: Mp4EncoderOptions) {
    this.output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: this.target });
    this.video = new CanvasSource(options.canvas, { codec: "avc", bitrate: options.videoBitrate, keyFrameInterval: 2 });
    this.audio = new AudioSampleSource({ codec: "aac", bitrate: options.audioBitrate });
    this.output.addVideoTrack(this.video, { frameRate: options.fps });
    this.output.addAudioTrack(this.audio);
  }

  start(): Promise<void> {
    return this.output.start();
  }

  add(timestampSec: number, durationSec: number): Promise<void> {
    return this.video.add(timestampSec, durationSec);
  }

  async addAudio(mix: StereoMix): Promise<void> {
    const chunk = Math.round(AUDIO_CHUNK_SEC * mix.sampleRate);
    for (let start = 0; start < mix.left.length; start += chunk) {
      const frames = Math.min(chunk, mix.left.length - start);
      const data = new Float32Array(frames * 2);
      data.set(mix.left.subarray(start, start + frames), 0);
      data.set(mix.right.subarray(start, start + frames), frames);
      const sample = new AudioSample({
        data,
        format: "f32-planar",
        numberOfChannels: 2,
        sampleRate: mix.sampleRate,
        timestamp: start / mix.sampleRate,
      });
      await this.audio.add(sample);
      sample.close();
    }
  }

  async finish(): Promise<Blob> {
    this.video.close();
    this.audio.close();
    await this.output.finalize();
    if (!this.target.buffer) throw new Error("Không tạo được file MP4");
    return new Blob([this.target.buffer], { type: "video/mp4" });
  }

  cancel(): Promise<void> {
    return this.output.cancel();
  }
}
