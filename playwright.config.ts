import { defineConfig } from "@playwright/test";
import { ensureE2eEnv } from "./e2e/e2eEnv";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3101";
const external = Boolean(process.env.E2E_BASE_URL);
if (!external) ensureE2eEnv(); // phải chạy trước khi Playwright khởi động webServer

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: process.env.PW_HEADED !== "1",
    viewport: { width: 1100, height: 1000 },
    locale: "vi-VN",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: external
    ? undefined
    : {
        command: "npx next dev -p 3101",
        url: "http://localhost:3101/dang-nhap",
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
