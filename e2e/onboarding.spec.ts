import { test, expect } from "./fixtures";

test("user onboarding", async ({ page, isMobile, menu, dismissToast }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Aparna's English Coaching/);
  await expect(
    page.getByText("Welcome to Aparna's English Coaching"),
  ).toBeVisible();

  await page.getByLabel("First name").fill("John");
  await page.getByLabel("Last name").fill("Doe");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("What's next?")).toBeVisible();
  await expect(page.getByText("1/3 done")).toBeVisible();
  await expect(
    page.getByText("Set up Aparna's English Coaching"),
  ).toBeVisible();
  await expect(page.getByText("Add your first parent")).toBeVisible();
  await expect(page.getByText("Add your first note")).toBeVisible();
  // M5: Quick add sits above the onboarding steps; the only import is the
  // admissions importer, which mobile does not offer (no admission screens)
  await expect(
    page.getByRole("button", { name: "Quick add enquiry" }),
  ).toBeVisible();
  if (!isMobile) {
    await expect(
      page.getByRole("button", { name: "Import CSV" }),
    ).toBeVisible();
  }

  await page
    .getByRole(isMobile ? "button" : "link", { name: "Add parent" })
    .click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "She/Her" }).click();
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill("Smith");
  await page.getByLabel("Title").fill("CEO");
  await page.getByLabel("Company").click();
  await page.getByPlaceholder("Search").fill("Smith Corp");
  await page.getByText("Create Smith Corp").click();
  await page
    .getByRole("group", { name: "Email addresses" })
    .getByRole("textbox", { name: "Email" })
    .fill("jane@smithcorp.com");
  await page
    .getByRole("group", { name: "Email addresses" })
    .getByRole("button", { name: "Add" })
    .click();

  await page
    .getByRole("group", { name: "Phone numbers" })
    .getByRole("textbox", { name: "Phone number" })
    .fill("+1234567890");
  await page
    .getByRole("group", { name: "Phone numbers" })
    .getByRole("button", { name: "Add" })
    .click();

  await page
    .getByLabel("LinkedIn URL")
    .fill("https://www.linkedin.com/in/jane-smith");

  await page
    .getByLabel("Background info (bio, how you met, etc)")
    .fill("Met at a conference.");

  await page.getByRole("switch", { name: "Has newsletter" }).check();

  await expect(page.getByLabel("Account manager *")).toHaveText("John Doe");

  await page.getByRole("button", { name: "Save" }).click();

  // Mobile shows no success snackbar
  if (!isMobile) {
    await dismissToast("Element created");
  }

  await expect(page.locator(isMobile ? "h2" : "h5")).toHaveText("Jane Smith");
  await expect(page.getByText("CEO at Smith Corp")).toBeVisible();

  // M3: with a first parent, the landing page is Today (the onboarding steps end here)
  await menu.goToDashboard();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
  await expect(page.getByText("2/3 done")).toBeHidden();
});
