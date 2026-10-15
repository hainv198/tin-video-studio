import type { FontFaceSpec } from "@/templates/VideoTemplate";

export interface FontSink {
  add(font: FontFace): void;
}

type CreateFace = (family: string, source: string, descriptors: FontFaceDescriptors) => FontFace;

const defaultCreate: CreateFace = (family, source, descriptors) => new FontFace(family, source, descriptors);

/** Nạp font của phong cách vào tập font (document.fonts hoặc self.fonts trong worker). */
export async function loadFonts(
  specs: readonly FontFaceSpec[],
  sink: FontSink,
  origin: string,
  createFace: CreateFace = defaultCreate,
): Promise<void> {
  const faces = specs.map((s) => createFace(s.family, `url("${new URL(s.url, origin).href}")`, { weight: s.weight }));
  const loaded = await Promise.all(faces.map((f) => f.load()));
  for (const face of loaded) sink.add(face);
}
