import {
  buildMessage,
  defaultFollowUp,
  SIGNATURE,
  TEMPLATE_KEYS,
  TEMPLATES,
  waDigits,
  waMeUrl,
  type TemplateKey,
} from "./templates";

const vars = {
  parentFirstName: "Meera",
  childName: "Riya",
  trialAt: "2026-12-05T12:00:00Z",
  parentTimeZone: "Europe/London",
  course: "Spoken English",
  feeAmountPaise: 450000,
  nextFeeDue: "2026-12-01",
  paymentLink: "https://rzp.io/l/abc123",
};

describe("WhatsApp templates", () => {
  it("has the 9 keys of MVP.md section 6, including progress_update", () => {
    expect([...TEMPLATE_KEYS].sort()).toEqual(
      [
        "absence_checkin",
        "after_trial",
        "fee_reminder",
        "payment_followup",
        "payment_link",
        "progress_update",
        "trial_confirm",
        "trial_reminder",
        "welcome",
      ].sort(),
    );
  });

  it("fills every template's variables and signs it", () => {
    for (const key of TEMPLATE_KEYS) {
      const text = buildMessage(key, vars);
      expect(text, key).toMatch(/^Hello Meera,/);
      expect(text, key).toContain("Riya");
      expect(text, key).not.toMatch(/undefined|null|\$\{/);
      expect(text.endsWith(SIGNATURE), key).toBe(true);
    }
  });

  it("shows the trial time in the parent's time zone", () => {
    expect(buildMessage("trial_confirm", vars)).toContain(
      "Sat 5 Dec, 12:00 pm London",
    );
  });

  it("puts the payment link, fee amount and due date in the fee reminder", () => {
    const text = buildMessage("fee_reminder", vars);
    expect(text).toContain("₹4,500");
    expect(text).toContain("1 Dec 2026");
    expect(text).toContain("https://rzp.io/l/abc123");
  });

  it("asks for a payment link only for payment_link and fee_reminder", () => {
    const needsLink = TEMPLATE_KEYS.filter(
      (key) => TEMPLATES[key].needsPaymentLink,
    );
    expect(needsLink.sort()).toEqual(["fee_reminder", "payment_link"]);
  });

  it("falls back to plain words when a value is missing", () => {
    expect(buildMessage("welcome", {})).toMatch(
      /^Hello, thank you for reaching out about English classes for your child!/,
    );
  });
});

describe("default next follow-up", () => {
  const now = new Date("2026-12-01T10:00:00Z");
  const trialAt = "2026-12-03T12:00:00Z";
  const expected: Record<TemplateKey, string> = {
    welcome: "2026-12-02T10:00:00.000Z",
    trial_confirm: "2026-12-03T14:00:00.000Z",
    trial_reminder: "2026-12-03T14:00:00.000Z",
    after_trial: "2026-12-03T10:00:00.000Z",
    payment_link: "2026-12-03T10:00:00.000Z",
    payment_followup: "2026-12-04T10:00:00.000Z",
    fee_reminder: "2026-12-04T10:00:00.000Z",
    absence_checkin: "2026-12-03T10:00:00.000Z",
    progress_update: "2026-12-08T10:00:00.000Z",
  };

  it.each(TEMPLATE_KEYS)("matches MVP.md section 6 for %s", (key) => {
    expect(defaultFollowUp(key, { now, trialAt }).toISOString()).toBe(
      expected[key],
    );
  });

  it("uses now + 1 day for a trial template when no trial time is set", () => {
    expect(defaultFollowUp("trial_confirm", { now }).toISOString()).toBe(
      "2026-12-02T10:00:00.000Z",
    );
  });
});

describe("wa.me URL", () => {
  it("uses the E.164 digits without the plus and URL-encodes the text", () => {
    const digits = waDigits("+447700900123");
    expect(digits).toBe("447700900123");
    expect(waMeUrl(digits!, "Hello Meera, & thanks?\nBye")).toBe(
      "https://wa.me/447700900123?text=Hello%20Meera%2C%20%26%20thanks%3F%0ABye",
    );
  });

  it("refuses a number that is not E.164", () => {
    expect(waDigits("9810000001")).toBeNull();
    expect(waDigits(null)).toBeNull();
    expect(waDigits("+0123")).toBeNull();
  });
});
