import { expect, test } from "../fixtures";

// M-102: the menu speaks the coaching domain, Companies is hidden, and an
// admission is saved without a company.
test.describe("MVP labels and menu", () => {
  test.beforeEach(async ({ createSales, createContact }) => {
    const owner = await createSales({
      administrator: true,
      email: "owner@example.test",
      first_name: "Test",
      last_name: "Owner",
      password: "password",
    });
    // The admissions board offers "Create admission" once a parent exists
    await createContact({
      first_name: "Meera",
      last_name: "Shah",
      sales_id: owner.id,
    });
  });

  test("shows Today, Parents and Admissions, hides Companies, and saves an admission without a company", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "The header menu and the admissions board are desktop-only",
    );

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admissions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Companies" })).toHaveCount(0);

    await page.getByRole("link", { name: "Admissions" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Create admission" }).click();

    const form = page.getByRole("dialog").filter({ hasText: "Linked to" });
    // The admission name is hidden: it follows the child name
    await form.getByRole("textbox", { name: "Child name" }).fill("Asha");
    // No company picked: the form must still save (company_id is optional)
    await expect(form.getByRole("combobox", { name: "Stage" })).toContainText(
      "Enquiry",
    );
    await form.getByRole("button", { name: "Save", exact: true }).click();

    await expect(form).toBeHidden();
    await expect(page.getByText("Asha")).toBeVisible();
  });
});
