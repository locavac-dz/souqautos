import { describe, expect, it } from "vitest";
import {
  checkCanDeleteMessage,
  checkCanMessage,
  checkMessageHasContent,
  shouldSendMessageNotification,
} from "@/lib/messaging";

describe("checkCanMessage", () => {
  it("allows messaging when neither self nor blocked", () => {
    expect(checkCanMessage({ isSelf: false, isBlocked: false })).toEqual({ ok: true });
  });

  it("prevents messaging yourself", () => {
    expect(checkCanMessage({ isSelf: true, isBlocked: false })).toEqual({
      ok: false,
      error: "cannot_message_self",
    });
  });

  it("prevents messaging when blocked", () => {
    expect(checkCanMessage({ isSelf: false, isBlocked: true })).toEqual({
      ok: false,
      error: "blocked",
    });
  });

  it("prioritizes the self-check over the block check", () => {
    expect(checkCanMessage({ isSelf: true, isBlocked: true })).toEqual({
      ok: false,
      error: "cannot_message_self",
    });
  });
});

describe("shouldSendMessageNotification", () => {
  it("notifies on the first unread message of a conversation", () => {
    expect(shouldSendMessageNotification({ unreadCountBeforeThisMessage: 0 })).toBe(true);
  });

  it("does not re-notify while earlier unread messages are still pending", () => {
    expect(shouldSendMessageNotification({ unreadCountBeforeThisMessage: 1 })).toBe(false);
    expect(shouldSendMessageNotification({ unreadCountBeforeThisMessage: 5 })).toBe(false);
  });
});

describe("checkCanDeleteMessage", () => {
  it("allows the sender to delete their own, not-yet-deleted message", () => {
    expect(checkCanDeleteMessage({ isSender: true, alreadyDeleted: false })).toEqual({ ok: true });
  });

  it("blocks a non-sender from deleting", () => {
    expect(checkCanDeleteMessage({ isSender: false, alreadyDeleted: false })).toEqual({
      ok: false,
      error: "not_sender",
    });
  });

  it("blocks deleting an already-deleted message", () => {
    expect(checkCanDeleteMessage({ isSender: true, alreadyDeleted: true })).toEqual({
      ok: false,
      error: "already_deleted",
    });
  });

  it("prioritizes the sender check over the already-deleted check", () => {
    expect(checkCanDeleteMessage({ isSender: false, alreadyDeleted: true })).toEqual({
      ok: false,
      error: "not_sender",
    });
  });
});

describe("checkMessageHasContent", () => {
  it("allows text only", () => {
    expect(checkMessageHasContent({ hasText: true, hasAttachment: false })).toEqual({ ok: true });
  });

  it("allows attachment only", () => {
    expect(checkMessageHasContent({ hasText: false, hasAttachment: true })).toEqual({ ok: true });
  });

  it("allows both text and attachment", () => {
    expect(checkMessageHasContent({ hasText: true, hasAttachment: true })).toEqual({ ok: true });
  });

  it("blocks a message with neither text nor attachment", () => {
    expect(checkMessageHasContent({ hasText: false, hasAttachment: false })).toEqual({
      ok: false,
      error: "empty_message",
    });
  });
});
