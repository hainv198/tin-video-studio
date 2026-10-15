import { notFound } from "next/navigation";
import { DevRenderPanel } from "@/views/dev/DevRenderPanel";

export const dynamic = "force-dynamic";

export default function DevRenderPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return (
    <main>
      <DevRenderPanel />
    </main>
  );
}
