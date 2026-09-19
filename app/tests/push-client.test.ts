import { describe, expect, it } from "vitest";
import { decidePushState, urlBase64ToUint8Array } from "@/lib/push-client";

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url key (with - and _, no padding) into the same bytes", () => {
    const bytes = Uint8Array.from([251, 255, 190, 0, 1, 2, 3, 250, 254]);
    const base64url = Buffer.from(bytes).toString("base64url");
    expect(base64url).toMatch(/[-_]/);
    expect(Array.from(urlBase64ToUint8Array(base64url))).toEqual(Array.from(bytes));
  });

  it("decodes a real-size VAPID public key to 65 bytes starting with 0x04", () => {
    const key = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 200)]).toString("base64url");
    expect(key).toHaveLength(87);
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("decidePushState", () => {
  const base = { supported: true, serverEnabled: true, hasWorker: true, permission: "default" as NotificationPermission, subscribed: false };

  it("offers activation when everything is available and not yet subscribed", () => {
    expect(decidePushState(base)).toBe("off");
  });

  it("shows the subscribed state, even if the permission was later withdrawn only when not subscribed", () => {
    expect(decidePushState({ ...base, subscribed: true, permission: "granted" })).toBe("on");
    expect(decidePushState({ ...base, permission: "denied" })).toBe("denied");
  });

  it("explains why it is unavailable, most fundamental cause first", () => {
    expect(decidePushState({ ...base, supported: false, serverEnabled: false })).toBe("unsupported");
    expect(decidePushState({ ...base, serverEnabled: false })).toBe("unavailable");
    expect(decidePushState({ ...base, hasWorker: false })).toBe("no-worker");
  });
});
