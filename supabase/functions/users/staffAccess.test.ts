// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyStaffAccess, isStaffCapError } from "./staffAccess";

const CAP_MESSAGE =
  "MVP allows two staff accounts (Owner and Counsellor); no Teacher accounts until role-based access (F-101) passes (ADR-A14)";

// An in-memory staff member: the login ban and the sales row, as Supabase would hold them
const buildStaff = ({
  banned,
  disabled,
  saleWriteError,
  banError,
}: {
  banned: boolean;
  disabled: boolean;
  saleWriteError?: Error;
  banError?: Error;
}) => {
  const state = { banned, disabled };
  return {
    state,
    steps: {
      setSaleDisabled: async (value: boolean) => {
        if (saleWriteError) throw saleWriteError;
        state.disabled = value;
      },
      setLoginBan: async (value: boolean) => {
        if (banError) throw banError;
        state.banned = value;
      },
    },
  };
};

describe("applyStaffAccess", () => {
  it("re-enables a staff member: the sales row first, then the login", async () => {
    const staff = buildStaff({ banned: true, disabled: true });

    await applyStaffAccess(false, staff.steps);

    expect(staff.state).toEqual({ banned: false, disabled: false });
  });

  it("keeps the login banned when the staff cap refuses the re-enable", async () => {
    const staff = buildStaff({
      banned: true,
      disabled: true,
      saleWriteError: Object.assign(new Error(CAP_MESSAGE), { code: "P0001" }),
    });

    const result = applyStaffAccess(false, staff.steps);

    await expect(result).rejects.toThrow("ADR-A14");
    expect(staff.state).toEqual({ banned: true, disabled: true });
  });

  it("disables a staff member: the login ban first, then the sales row", async () => {
    const staff = buildStaff({ banned: false, disabled: false });

    await applyStaffAccess(true, staff.steps);

    expect(staff.state).toEqual({ banned: true, disabled: true });
  });

  it("does not mark the row disabled when the login ban fails, so the failure is visible", async () => {
    const staff = buildStaff({
      banned: false,
      disabled: false,
      banError: new Error("auth unavailable"),
    });

    const result = applyStaffAccess(true, staff.steps);

    await expect(result).rejects.toThrow("auth unavailable");
    expect(staff.state).toEqual({ banned: false, disabled: false });
  });
});

describe("isStaffCapError", () => {
  it("recognises the cap trigger's refusal, from an Error or a plain PostgREST error object", () => {
    expect(isStaffCapError(new Error(CAP_MESSAGE))).toBe(true);
    expect(isStaffCapError({ message: CAP_MESSAGE, code: "P0001" })).toBe(true);
  });

  it("does not mistake other failures for the cap", () => {
    expect(isStaffCapError(new Error("network down"))).toBe(false);
    expect(isStaffCapError(null)).toBe(false);
  });
});
