import { createClient } from "@supabase/supabase-js";
import { expect, test } from "../fixtures";

const adminSupabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341",
  process.env.SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DAY_MS = 24 * 60 * 60 * 1000;

// Inserts an admission, then backdates stage_changed_at: the stage trigger only
// rewrites it on insert and on a stage change, so a plain update keeps the value.
async function createAdmission({
  childName,
  course,
  nextActionAt,
  daysInStage,
  salesId,
}: {
  childName: string;
  course: string;
  nextActionAt: string;
  daysInStage: number;
  salesId: number;
}) {
  const { data, error } = await adminSupabase
    .from("deals")
    .insert({
      name: childName,
      child_name: childName,
      course,
      stage: "enquiry",
      next_action_at: nextActionAt,
      sales_id: salesId,
      index: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create admission: ${error.message}`);

  const { error: updateError } = await adminSupabase
    .from("deals")
    .update({
      stage_changed_at: new Date(Date.now() - daysInStage * DAY_MS),
    })
    .eq("id", data.id);
  if (updateError) {
    throw new Error(`Failed to backdate admission: ${updateError.message}`);
  }
}

// M-205: the card shows child, course, next action (red when overdue) and days in stage
test.describe("MVP board card", () => {
  test.beforeEach(async ({ createSales }) => {
    const owner = await createSales({
      administrator: true,
      email: "owner@example.test",
      first_name: "Test",
      last_name: "Owner",
      password: "password",
    });
    await createAdmission({
      childName: "Asha",
      course: "grammar",
      nextActionAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      daysInStage: 3,
      salesId: owner.id,
    });
    await createAdmission({
      childName: "Kabir",
      course: "spoken-english",
      nextActionAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
      daysInStage: 1,
      salesId: owner.id,
    });
  });

  test("shows child, course, next action and days in stage, overdue in red", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The admissions board is desktop-only");

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Admissions" }).click();

    const asha = page
      .locator("[data-rfd-draggable-id]")
      .filter({ hasText: "Asha" });
    await expect(asha.getByText("Grammar (IV-XII)")).toBeVisible();
    await expect(asha.getByText("3 days in stage")).toBeVisible();
    const overdue = asha.getByText(/^Next: .*\(overdue\)$/);
    await expect(overdue).toBeVisible();
    await expect(overdue).toHaveAttribute("data-overdue", "true");
    await expect(overdue).toHaveClass(/text-destructive/);

    const kabir = page
      .locator("[data-rfd-draggable-id]")
      .filter({ hasText: "Kabir" });
    await expect(kabir.getByText("Spoken English")).toBeVisible();
    await expect(kabir.getByText("1 day in stage")).toBeVisible();
    const upcoming = kabir.getByText(/^Next: /);
    await expect(upcoming).toBeVisible();
    await expect(upcoming).not.toHaveText(/overdue/);
    await expect(upcoming).not.toHaveClass(/text-destructive/);
  });
});
