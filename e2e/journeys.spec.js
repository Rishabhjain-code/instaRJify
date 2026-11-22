const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

const password = "A browser test passphrase!";

test("register, publish, edit, change privacy, sign out, and sign in", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `browser-${suffix}@example.test`;
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good to see you." })).toBeVisible();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name").fill("Browser Creator");
  await page.getByLabel("Handle", { exact: true }).fill(`browser_${suffix}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your daily dose of better." }),
  ).toBeVisible();
  await page
    .getByLabel("Something worth sharing?", { exact: false })
    .fill("A browser-verified learning note.");
  await page.getByRole("button", { name: "Share a post", exact: true }).click();
  await expect(
    page.getByText("A browser-verified learning note.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit post", exact: true }).click();
  await page.getByLabel("Edit caption").fill("An edited browser-verified note.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("An edited browser-verified note.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: false }).click();
  await page.getByLabel("About you").fill("Learning with intention.");
  await page.getByRole("checkbox", { name: "Public profile", exact: false }).uncheck();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status", { name: "Profile save status" })).toHaveText(
    "Your changes have been saved.",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Good to see you." })).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your daily dose of better." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("An edited browser-verified note.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(
    page.getByText("An edited browser-verified note.", { exact: true }),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("private follow requests can be accepted through two independent browser sessions", async ({
  browser,
  baseURL,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [owner, viewer] = contexts;
    const suffix = randomUUID().slice(0, 8);
    const register = async (context, role, isPublic) => {
      const response = await context.request.post(`${baseURL}/api/v1/auth/register`, {
        headers: { Origin: baseURL },
        data: {
          name: `${role} ${suffix}`,
          handle: `${role}_${suffix}`,
          email: `${role}-${suffix}@example.test`,
          password,
          isPublic,
        },
      });
      expect(response.status()).toBe(201);
      return (await response.json()).data;
    };
    const privateUser = await register(owner, "owner", false);
    await register(viewer, "viewer", true);
    const created = await owner.request.post(`${baseURL}/api/v1/posts`, {
      headers: { Origin: baseURL, "Idempotency-Key": randomUUID() },
      data: { caption: `A private note ${suffix}`, purpose: "learning" },
    });
    expect(created.status()).toBe(201);
    const viewerPage = await viewer.newPage();
    await viewerPage.goto(baseURL);
    await viewerPage.getByRole("button", { name: "Find people", exact: false }).click();
    await viewerPage.getByLabel("Find a handle").fill(privateUser.handle);
    await viewerPage.getByRole("button", { name: "Search people", exact: true }).click();
    await viewerPage.getByRole("button", { name: new RegExp(privateUser.name) }).click();
    await expect(
      viewerPage.getByRole("heading", { name: "A more personal circle." }),
    ).toBeVisible();
    await viewerPage
      .getByRole("button", { name: "Request to follow", exact: true })
      .click();
    await expect(
      viewerPage.getByRole("button", { name: "Cancel request", exact: true }),
    ).toBeVisible();
    const ownerPage = await owner.newPage();
    await ownerPage.goto(baseURL);
    await ownerPage
      .getByRole("button", { name: "Follow requests", exact: false })
      .click();
    await ownerPage.getByRole("button", { name: "Accept", exact: true }).click();
    await viewerPage.reload();
    await expect(
      viewerPage.getByText(`A private note ${suffix}`, { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("mobile navigation and the feed fit a narrow viewport", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      name: "Mobile Creator",
      handle: `mobile_${suffix}`,
      email: `mobile-${suffix}@example.test`,
      password,
    },
  });

  expect(registered.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your daily dose of better." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Follow requests", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Your circle, your choice." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test("a lost publish response keeps the draft and retry key without duplicating the post", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      name: "Retry Creator",
      handle: `retry_${suffix}`,
      email: `retry-${suffix}@example.test`,
      password,
    },
  });
  expect(registered.status()).toBe(201);
  const keys = [];
  let release;
  let reportCommit;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const committed = new Promise((resolve) => {
    reportCommit = resolve;
  });
  await page.route("**/api/v1/posts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length > 1) return route.continue();
    const response = await route.fetch();
    reportCommit(response.status());
    await gate;
    return route.abort("failed");
  });
  await page.goto("/");
  const draft = page.getByLabel("Something worth sharing?", { exact: false });
  const caption = `A retry-safe browser note ${suffix}`;
  await draft.fill(caption);
  await page.getByRole("button", { name: "Share a post", exact: true }).click();
  expect(await committed).toBe(201);
  await expect(draft).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(draft).toHaveValue(caption);
  await page.getByRole("button", { name: "Share a post", exact: true }).click();
  await expect(page.getByText(caption, { exact: true })).toHaveCount(1);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
