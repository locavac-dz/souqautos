import { describe, expect, it } from "vitest";
import {
  MAX_PROSPECT_NOTE_LENGTH,
  countByStatus,
  isAwaitingReply,
  parseProspectStatusFilter,
  prospectUpdateSchema,
  sortProspects,
  type ProspectRowBase,
} from "@/lib/prospects";

const row = (o: Partial<ProspectRowBase> & { conversationId: string }): ProspectRowBase => ({
  status: "NOUVEAU",
  awaitingReply: false,
  lastActivityAt: new Date("2026-09-10T10:00:00Z"),
  ...o,
});

describe("parseProspectStatusFilter", () => {
  it("accepts the five statuses", () => {
    for (const s of ["NOUVEAU", "A_RAPPELER", "EN_NEGOCIATION", "GAGNE", "PERDU"]) expect(parseProspectStatusFilter(s)).toBe(s);
  });

  it("treats anything unknown from the address as « no filter »", () => {
    for (const raw of [undefined, "", "nouveau", "VENDU", "1; DROP TABLE", ["nope"]]) {
      expect(parseProspectStatusFilter(raw as string), String(raw)).toBeNull();
    }
    expect(parseProspectStatusFilter(["PERDU", "GAGNE"])).toBe("PERDU");
  });
});

describe("prospectUpdateSchema", () => {
  it("accepts a status, a note, or both", () => {
    expect(prospectUpdateSchema.parse({ status: "A_RAPPELER" })).toEqual({ status: "A_RAPPELER" });
    expect(prospectUpdateSchema.parse({ note: "Rappeler jeudi" })).toEqual({ note: "Rappeler jeudi" });
    expect(prospectUpdateSchema.parse({ status: "GAGNE", note: "Vendu" })).toEqual({ status: "GAGNE", note: "Vendu" });
  });

  it("trims the note, and an empty or blank note clears it", () => {
    expect(prospectUpdateSchema.parse({ note: "  bon contact  " }).note).toBe("bon contact");
    expect(prospectUpdateSchema.parse({ note: "" }).note).toBeNull();
    expect(prospectUpdateSchema.parse({ note: "   \n " }).note).toBeNull();
    expect(prospectUpdateSchema.parse({ note: null }).note).toBeNull();
  });

  it("refuses an empty update, unknown statuses, unknown fields and oversized notes", () => {
    expect(prospectUpdateSchema.safeParse({}).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ status: "VENDU" }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ status: "gagne" }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ status: "PERDU", conversationId: "autre" }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ status: "PERDU", updatedById: "x" }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ note: "x".repeat(MAX_PROSPECT_NOTE_LENGTH) }).success).toBe(true);
    expect(prospectUpdateSchema.safeParse({ note: "x".repeat(MAX_PROSPECT_NOTE_LENGTH + 1) }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse({ note: 42 }).success).toBe(false);
    expect(prospectUpdateSchema.safeParse(null).success).toBe(false);
    expect(prospectUpdateSchema.safeParse("PERDU").success).toBe(false);
  });
});

describe("isAwaitingReply", () => {
  const at = new Date("2026-09-10T10:00:00Z");
  it("is true when the last message comes from the buyer", () => {
    expect(isAwaitingReply({ senderId: "buyer", createdAt: at }, "buyer")).toBe(true);
  });
  it("is false when the team answered last, or when nothing was ever said", () => {
    expect(isAwaitingReply({ senderId: "seller", createdAt: at }, "buyer")).toBe(false);
    expect(isAwaitingReply(null, "buyer")).toBe(false);
  });
});

describe("sortProspects", () => {
  it("puts open prospects waiting for an answer first, then the most recent", () => {
    const waitingOld = row({ conversationId: "a", awaitingReply: true, lastActivityAt: new Date("2026-09-01T00:00:00Z") });
    const waitingNew = row({ conversationId: "b", awaitingReply: true, lastActivityAt: new Date("2026-09-05T00:00:00Z") });
    const answeredRecent = row({ conversationId: "c", lastActivityAt: new Date("2026-09-09T00:00:00Z") });
    const answeredOld = row({ conversationId: "d", lastActivityAt: new Date("2026-08-01T00:00:00Z") });
    expect(sortProspects([answeredOld, waitingOld, answeredRecent, waitingNew]).map((r) => r.conversationId)).toEqual(["b", "a", "c", "d"]);
  });

  it("does not push a closed prospect (sold or lost) to the top just because the buyer wrote last", () => {
    const closedButRecent = row({ conversationId: "closed", status: "PERDU", awaitingReply: true, lastActivityAt: new Date("2026-09-09T00:00:00Z") });
    const openWaiting = row({ conversationId: "open", status: "A_RAPPELER", awaitingReply: true, lastActivityAt: new Date("2026-09-01T00:00:00Z") });
    expect(sortProspects([closedButRecent, openWaiting]).map((r) => r.conversationId)).toEqual(["open", "closed"]);
    const won = row({ conversationId: "won", status: "GAGNE", awaitingReply: true });
    expect(sortProspects([won, openWaiting])[0].conversationId).toBe("open");
  });

  it("is stable on ties and does not modify its input", () => {
    const x = row({ conversationId: "x" });
    const y = row({ conversationId: "y" });
    const input = [y, x];
    expect(sortProspects(input).map((r) => r.conversationId)).toEqual(["x", "y"]);
    expect(input.map((r) => r.conversationId)).toEqual(["y", "x"]);
  });
});

describe("countByStatus", () => {
  it("counts every status, including those with nobody", () => {
    expect(countByStatus([{ status: "NOUVEAU" }, { status: "NOUVEAU" }, { status: "PERDU" }])).toEqual({ NOUVEAU: 2, A_RAPPELER: 0, EN_NEGOCIATION: 0, GAGNE: 0, PERDU: 1 });
    expect(countByStatus([])).toEqual({ NOUVEAU: 0, A_RAPPELER: 0, EN_NEGOCIATION: 0, GAGNE: 0, PERDU: 0 });
  });
});
