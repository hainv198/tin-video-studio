"use client";

import { useEffect, useSyncExternalStore } from "react";
import { browserEnv, createClientServices } from "@/client/container";
import { createStudio, type Studio } from "@/client/controllers/createStudio";
import { StudioShell } from "./StudioShell";

let instance: Studio | null = null;

/** Tạo studio một lần ở trình duyệt (cần window); trên server và lúc hydrate trả null. */
function getStudio(): Studio {
  if (!instance) {
    instance = createStudio(createClientServices(browserEnv()), {
      // replace (không phải assign) để lint của Next không cảnh báo; hết phiên thì không cần giữ /studio trong lịch sử
      onAuthLost: () => {
        window.location.replace(`/dang-nhap?next=${encodeURIComponent("/studio")}`);
      },
    });
  }
  return instance;
}

const noopSubscribe = () => () => {};

export function StudioApp() {
  const studio = useSyncExternalStore(noopSubscribe, getStudio, () => null);

  useEffect(() => {
    if (!studio) return;
    void studio.wizard.boot();
    // Studio là singleton của module và StrictMode chạy effect hai lần, nên cleanup KHÔNG dispose
    // (dispose thu hồi URL video đã dựng); chỉ dừng việc đang chạy và lưu bản nháp.
    return () => {
      studio.render.cancel();
      studio.search.cancel();
      void studio.session.flush();
    };
  }, [studio]);

  if (!studio) return <p className="mt-8 text-neutral-400">Đang tải…</p>;
  return <StudioShell studio={studio} />;
}
