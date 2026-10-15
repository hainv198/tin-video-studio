"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { SessionController } from "@/client/controllers/SessionController";
import { AuthClient } from "@/client/services/AuthClient";

export function LogoutButton() {
  const controller = useMemo(() => new SessionController(new AuthClient()), []);
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md bg-neutral-800 px-3 py-1 text-sm"
      onClick={async () => {
        try {
          await controller.logout();
        } finally {
          router.replace("/dang-nhap");
          router.refresh();
        }
      }}
    >
      Đăng xuất
    </button>
  );
}
