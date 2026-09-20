import { expect, test } from "@playwright/test"

const truthEngineBaseUrl =
  process.env.TRUTH_ENGINE_BASE_URL ?? "http://127.0.0.1:19024"

for (const entryPath of [
  "/truth-engine",
  "/truth-engine/",
  "/truth-engine/app/upload",
]) {
  test(`Truth Engine renders the upload interface from ${entryPath}`, async ({
    page,
  }) => {
    const fatalErrors: string[] = []
    const failedAssets: string[] = []

    page.on("pageerror", (error) => fatalErrors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") fatalErrors.push(message.text())
    })
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(truthEngineBaseUrl)) {
        failedAssets.push(
          `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "request failed"}`,
        )
      }
    })
    page.on("response", (response) => {
      if (
        response.url().startsWith(truthEngineBaseUrl) &&
        response.status() >= 400
      ) {
        failedAssets.push(`${response.status()} ${response.url()}`)
      }
    })

    const response = await page.goto(`${truthEngineBaseUrl}${entryPath}`, {
      waitUntil: "networkidle",
    })

    expect(response?.ok()).toBe(true)
    await expect(page).toHaveURL(
      `${truthEngineBaseUrl}/truth-engine/app/upload`,
    )
    await expect(
      page.getByRole("heading", { name: "Upload summaries & parse review" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Start analysis" }),
    ).toBeVisible()
    await expect(page.locator('input[type="file"]')).toBeVisible()
    expect(failedAssets).toEqual([])
    expect(fatalErrors).toEqual([])
  })
}