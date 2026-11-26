// Staff access changes (ADR-A14, M-108): the restrictive step always runs first, so a
// failure at any point leaves the person locked out, never let in.
// - Re-enable: write sales.disabled = false first (the database refuses a third active
//   staff account), and lift the login ban only once that write succeeded.
// - Disable: ban the login first, then mark the sales row disabled.

export interface StaffAccessSteps {
  /** Writes sales.disabled; throws when the database refuses it. */
  setSaleDisabled: (disabled: boolean) => Promise<void>;
  /** Bans or unbans the auth user; throws on failure. */
  setLoginBan: (banned: boolean) => Promise<void>;
}

export const STAFF_CAP_ERROR_CODE = "staff_cap_reached";

export async function applyStaffAccess(
  disabled: boolean,
  steps: StaffAccessSteps,
): Promise<void> {
  if (disabled) {
    await steps.setLoginBan(true);
    await steps.setSaleDisabled(true);
    return;
  }
  await steps.setSaleDisabled(false);
  await steps.setLoginBan(false);
}

/** The sales_mvp_two_staff_cap trigger's refusal (its message names ADR-A14). */
export function isStaffCapError(error: unknown): error is { message: string } {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.includes("ADR-A14");
}
