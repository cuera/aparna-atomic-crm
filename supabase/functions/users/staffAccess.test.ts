// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyStaffAccess,
  assertStaffSlotFree,
  isStaffCapError,
  STAFF_CAP_MESSAGE,
} from "./staffAccess";

const CAP_MESSAGE = STAFF_CAP_MESSAGE;

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

describe("assertStaffSlotFree (P-28)", () => {
  it("lets an invitation through while fewer than two staff accounts are active", async () => {
    await expect(assertStaffSlotFree(async () => 1)).resolves.toBeUndefined();
  });

  it("refuses a third active account with the cap message the app shows", async () => {
    const result = assertStaffSlotFree(async () => 2);

    await expect(result).rejects.toThrow(STAFF_CAP_MESSAGE);
    await expect(result).rejects.toSatisfy(isStaffCapError);
  });

  it("passes a failed count through as an ordinary error, not as the cap", async () => {
    const countError = new Error("connection refused");

    const result = assertStaffSlotFree(async () => {
      throw countError;
    });

    await expect(result).rejects.toBe(countError);
  });

  it("uses the exact text of the database trigger, so both refusals read the same", () => {
    const sql = readFileSync(
      new URL("../../schemas/02_functions.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain(`raise exception '${STAFF_CAP_MESSAGE}'`);
  });
});
