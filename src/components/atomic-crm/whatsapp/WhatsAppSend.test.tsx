import { ResourceContextProvider, useGetOne } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import { ContactEditSheet } from "../contacts/ContactEditSheet";
import { DealShow } from "../deals/DealShow";
import { DEFAULT_USER } from "../providers/fakerest/authProvider";
import type { Contact, Deal } from "../types";
import { WhatsAppSend } from "./WhatsAppSend";

const parent = buildContact({
  id: 1,
  first_name: "Meera",
  phone_e164: "+447700900123",
  timezone: "Europe/London",
  whatsapp_opt_in: true,
  sales_id: DEFAULT_USER.id,
});

const admission = buildDeal({
  id: 1,
  name: "Riya",
  child_name: "Riya",
  stage: "enquiry",
  contact_ids: [1],
  first_response_at: null,
  next_action_at: "2026-11-20T10:00:00.000Z",
});

const DealProbe = () => {
  const { data } = useGetOne<Deal>("deals", { id: 1 });
  return (
    <p data-testid="deal-probe">
      {data?.first_response_at ?? "no first response"}|{data?.next_action_at}
    </p>
  );
};

const ContactProbe = () => {
  const { data } = useGetOne<Contact>("contacts", { id: 1 });
  return <p>opt-in: {String(data?.whatsapp_opt_in)}</p>;
};

const readProbe = (element: Element) =>
  (element.textContent ?? "").split("|") as [string, string];

describe("One-tap WhatsApp send", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockReturnValue(null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("opens wa.me in a new tab from the Admission page, then logs the note, first response and next follow-up", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [parent], deals: [admission] }}>
        <ResourceContextProvider value="deals">
          <DealShow open id="1" />
        </ResourceContextProvider>
        <DealProbe />
      </StoryWrapper>,
    );
    const before = Date.now();

    await screen.getByRole("button", { name: "WhatsApp" }).click();
    await screen.getByRole("menuitem", { name: "Welcome" }).click();

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/wa\.me\/447700900123\?text=Hello%20Meera%2C%20thank%20you/,
      ),
      "_blank",
      "noopener,noreferrer",
    );
    await expect.element(screen.getByText("Sent?")).toBeVisible();
    await screen.getByRole("button", { name: "Yes, sent" }).click();

    await expect.element(screen.getByText("WhatsApp: welcome")).toBeVisible();
    await expect
      .poll(() => readProbe(screen.getByTestId("deal-probe").element())[0])
      .not.toBe("no first response");
    const [firstResponse, nextAction] = readProbe(
      screen.getByTestId("deal-probe").element(),
    );
    expect(Date.parse(firstResponse)).toBeGreaterThanOrEqual(before - 1000);
    // welcome: next follow-up defaults to now + 1 day (minute precision in the dialog)
    const oneDay = 24 * 60 * 60 * 1000;
    expect(Date.parse(nextAction)).toBeGreaterThanOrEqual(
      before + oneDay - 60_000,
    );
    expect(Date.parse(nextAction)).toBeLessThanOrEqual(Date.now() + oneDay);
  });

  it("asks for the Razorpay link before opening WhatsApp and keeps an earlier first response", async () => {
    const answered = {
      ...admission,
      first_response_at: "2026-11-01T08:00:00.000Z",
    };
    const screen = await render(
      <StoryWrapper data={{ contacts: [parent], deals: [answered] }}>
        <WhatsAppSend deal={answered} keys={["payment_link"]} />
        <DealProbe />
      </StoryWrapper>,
    );

    await screen
      .getByRole("button", { name: "WhatsApp: Payment link" })
      .click();
    await expect
      .element(screen.getByLabelText("Razorpay payment link"))
      .toBeVisible();
    expect(openSpy).not.toHaveBeenCalled();

    await screen
      .getByLabelText("Razorpay payment link")
      .fill("https://rzp.io/l/abc123");
    await screen.getByRole("button", { name: "Open WhatsApp" }).click();

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("https://rzp.io/l/abc123")),
      "_blank",
      "noopener,noreferrer",
    );
    await screen.getByRole("button", { name: "Yes, sent" }).click();
    await expect
      .poll(() => readProbe(screen.getByTestId("deal-probe").element())[1])
      .not.toBe("2026-11-20T10:00:00.000Z");
    expect(readProbe(screen.getByTestId("deal-probe").element())[0]).toBe(
      "2026-11-01T08:00:00.000Z",
    );
  });

  it("is disabled with a visible reason when the parent opted out", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [{ ...parent, whatsapp_opt_in: false }],
          deals: [admission],
        }}
      >
        <WhatsAppSend deal={admission} keys={["welcome"]} />
      </StoryWrapper>,
    );

    await expect
      .element(
        screen.getByText("The parent has opted out of WhatsApp messages."),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "WhatsApp: Welcome" }))
      .toBeDisabled();
  });

  it("lets the Parent form switch WhatsApp messages off", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [parent] }}>
        <ContactEditSheet open onOpenChange={() => {}} contactId={1} />
        <ContactProbe />
      </StoryWrapper>,
    );

    // The form renders before the record loads, then resets to it
    await expect
      .element(screen.getByLabelText(/first name/i))
      .toHaveValue("Meera");
    const toggle = screen.getByRole("switch", {
      name: "WhatsApp messages allowed",
    });
    await expect.element(toggle).toBeChecked();
    await toggle.click();
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.element(screen.getByText("opt-in: false")).toBeVisible();
  });
});
