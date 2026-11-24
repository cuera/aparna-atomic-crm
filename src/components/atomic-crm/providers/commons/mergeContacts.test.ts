import { describe, expect, it } from "vitest";

import type { Db } from "../fakerest/dataGenerator/types";
import { createDataProvider } from "../fakerest/dataProvider";

const buildProvider = (contacts: Record<string, unknown>[]) =>
  createDataProvider({
    db: {
      contacts,
      tasks: [],
      contact_notes: [],
      deals: [],
      tags: [],
    } as unknown as Db,
    latency: 0,
    silent: true,
  });

const lastSeen = "2026-01-01T00:00:00.000Z";

describe("mergeContacts (demo mode)", () => {
  it("keeps the loser's WhatsApp number, country and time zone when the winner has none, like the SQL merge", async () => {
    // Arrange
    const dataProvider = buildProvider([
      { id: 1, first_name: "Winner", tags: [], last_seen: lastSeen },
      {
        id: 2,
        first_name: "Loser",
        tags: [],
        last_seen: lastSeen,
        country: "United Kingdom",
        timezone: "Europe/London",
        phone_e164: "+447700900123",
        whatsapp_opt_in: true,
      },
    ]);

    // Act
    await dataProvider.mergeContacts(2, 1);

    // Assert
    const { data: winner } = await dataProvider.getOne("contacts", { id: 1 });
    expect(winner.phone_e164).toBe("+447700900123");
    expect(winner.country).toBe("United Kingdom");
    expect(winner.timezone).toBe("Europe/London");
  });

  it("keeps an opt-out from either parent after the merge", async () => {
    // Arrange
    const dataProvider = buildProvider([
      {
        id: 1,
        first_name: "Winner",
        tags: [],
        last_seen: lastSeen,
        whatsapp_opt_in: true,
      },
      {
        id: 2,
        first_name: "Loser",
        tags: [],
        last_seen: lastSeen,
        whatsapp_opt_in: false,
      },
    ]);

    // Act
    await dataProvider.mergeContacts(2, 1);

    // Assert
    const { data: winner } = await dataProvider.getOne("contacts", { id: 1 });
    expect(winner.whatsapp_opt_in).toBe(false);
  });
});
