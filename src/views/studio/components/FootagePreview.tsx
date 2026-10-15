"use client";

import { useEffect, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import type { Footage } from "@/domain/Footage";

export function FootagePreview({ studio, footage }: { studio: Studio; footage: Footage | undefined }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void studio.footage.previewSource(footage).then((source) => {
      if (cancelled) return;
      if (source instanceof Blob) {
        objectUrl = studio.services.env.createUrl(source);
        setSrc(objectUrl);
      } else {
        setSrc(source);
      }
    });
    return () => {
      cancelled = true;
      if (objectUrl) studio.services.env.revokeUrl(objectUrl);
    };
  }, [studio, footage]);

  const box = "aspect-video w-full max-w-60 overflow-hidden rounded-md bg-neutral-800 object-cover";
  if (!footage || footage.kind === "fallback" || !src) {
    return <div className={`${box} flex items-center justify-center text-xs text-neutral-500`}>Nền mặc định</div>;
  }
  return footage.kind === "video" ? (
    <video className={box} src={src} muted loop autoPlay playsInline />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={box} src={src} alt="Cảnh trám đang chọn" />
  );
}
