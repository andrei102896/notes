import { defineConfig } from "@playwright/test";

/** E2E config for the extension suite (tests/e2e). Runs against dist-e2e (ExtPay disabled — see tests/e2e/README.md); one worker because each test boots its own persistent Chromium profile with the extension loaded. */
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.001,
    },
  },
  reporter: [["list"]],
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  use: {
    trace: "retain-on-failure",
  },
});
