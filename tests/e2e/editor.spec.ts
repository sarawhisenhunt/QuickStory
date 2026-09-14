import { expect, test } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAf2N1Z4AAAAASUVORK5CYII=",
  "base64"
);

test("creates and fine-tunes a quick story", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Upload everything/i })).toBeVisible();
  await expect(page.locator(".template-card")).toHaveCount(6);

  await page.getByRole("button", { name: /Two Video Memories/i }).click();
  await expect(page.getByRole("button", { name: /Two Video Memories/i })).toHaveAttribute("aria-pressed", "true");

  await page.locator('input[type="file"]').setInputFiles([
    { name: "first-day.png", mimeType: "image/png", buffer: tinyPng },
    { name: "favorite-moment.png", mimeType: "image/png", buffer: tinyPng }
  ]);
  await expect(page.locator(".timeline-clip")).toHaveCount(2);

  await page.locator(".timeline-clip").first().getByRole("button", { name: /Edit clip/i }).click();
  await expect(page.getByRole("heading", { name: "Edit clip" })).toBeVisible();
  await page.getByPlaceholder("Optional words just for this moment").fill("Best part of the day");
  await page.getByRole("button", { name: "Done editing" }).click();
  await expect(page.locator(".stage-copy h1")).toHaveText("Best part of the day");

  await page.getByRole("button", { name: "1:1" }).click();
  await expect(page.locator(".stage-frame")).toHaveClass(/ratio-1-1/);

  await page.screenshot({ path: testInfo.outputPath("quickstory.png"), fullPage: true });
});
