"use client";

import { useMemo } from "react";
import { SessionController } from "@/client/controllers/SessionController";
import { AuthClient } from "@/client/services/AuthClient";

export function LogoutButton() {
  const controller = useMemo(() => new SessionController(new AuthClient()), []);
  return (
    <button
      type="button"
      className="rounded-md bg-neutral-800 px-3 py-1 text-sm"
      onClick={async () => {
        try {
          await controller.logout();
        } finally {
          // Tải lại cả trang (không điều hướng mềm) để bỏ singleton studio của phiên cũ.
          window.location.assign(new URL("/dang-nhap", window.location.origin).href);
        }
      }}
    >
      Đăng xuất
    </button>
  );
}
