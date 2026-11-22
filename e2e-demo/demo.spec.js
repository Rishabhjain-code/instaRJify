const { test, expect } = require("@playwright/test");

test("the standalone demo filters sample posts without an API", async ({ page }) => {
  const errors = [];
  const apiRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("./");
  await expect(page.getByText("INTERACTIVE DEMO", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Follow your curiosity." }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(6);
  await page.getByRole("button", { name: "Learning", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(2);
  await expect(page.locator("article").first().getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "Fitness", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "All purposes", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(6);
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("local posts validate, persist, edit, and delete without treating text as HTML", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Publish locally", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Write a little something");
  const caption = '<img src=x onerror="window.demoInjected=true"> A small learning win.';
  await page
    .getByRole("textbox", { name: "One small thing worth sharing?" })
    .fill(caption);
  await page.getByRole("combobox", { name: "Post purpose" }).selectOption("mindful");
  await page.getByRole("button", { name: "Publish locally", exact: true }).click();
  await expect(page.locator("article").first()).toContainText(caption);
  await expect(page.locator("article").first()).toContainText("Mindful");
  expect(await page.evaluate(() => window.demoInjected)).toBeUndefined();
  await page.reload();
  await expect(page.locator("article").first()).toContainText(caption);
  await page.getByRole("button", { name: "Your posts", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit post", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Give your thought a little polish." })
    .fill("A revised local thought.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(page.locator("article").first()).toContainText("A revised local thought.");
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.reload();
  await expect(page.locator("article")).toHaveCount(6);
});

test("following, creator search, and reset affect only the visitor's local demo", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Your feed", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Follow Avery Morgan", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(4);
  await page.reload();
  await page.getByRole("button", { name: "Your feed", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(4);
  await page.getByRole("button", { name: "Find people", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Find a sample creator", exact: true })
    .fill("rowan");
  const people = page.getByRole("region", { name: "Sample creators" });
  await expect(
    people.getByRole("heading", { name: "Rowan Brooks", exact: true }),
  ).toBeVisible();
  await expect(
    people.getByRole("heading", { name: "Avery Morgan", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Find a sample creator", exact: true })
    .fill("no-such-creator");
  await expect(people).toContainText("No sample creators match");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Demo reset");
  await page.getByRole("button", { name: "Your feed", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Your posts", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(0);
});

test("corrupted saved state reports the problem and restores sample content", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("instarjify:pages-demo:v1", '{"posts":null}'),
  );
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText(
    "Saved demo data could not be loaded",
  );
  await expect(page.locator("article")).toHaveCount(6);
});

test("unavailable browser storage does not masquerade as durable saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText(
    "changes will not survive a refresh",
  );
  await expect(page.locator("article")).toHaveCount(6);
  await page
    .getByRole("textbox", { name: "One small thing worth sharing?" })
    .fill("An in-memory demo post.");
  await page.getByRole("button", { name: "Publish locally", exact: true }).click();
  await expect(page.locator("article").first()).toContainText("An in-memory demo post.");
});

test("mobile layout and source links work under the repository subpath", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const failedResponses = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(response.url());
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Follow your curiosity." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Full-stack source" })).toHaveAttribute(
    "href",
    "https://github.com/Rishabhjain-code/instaRJify",
  );
  await page.getByText("What is running here?", { exact: true }).click();
  await expect(page.locator("details")).toContainText("not the Node.js API or MySQL");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Horizontal overflow at ${width}px`,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Your posts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Small steps, worth sharing." }),
  ).toBeVisible();
  expect(failedResponses).toEqual([]);
});
