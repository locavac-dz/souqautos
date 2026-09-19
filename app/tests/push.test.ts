import { describe, expect, it } from "vitest";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import {
  MAX_ENDPOINT_LENGTH,
  buildPushPayload,
  isAllowedPushEndpoint,
  pushSubscriptionSchema,
  resolvePushConfig,
} from "@/lib/push";

const b64url = (buffer: Buffer) => buffer.toString("base64url");
// Clés réelles (format identique à celles d'un navigateur), pas des chaînes inventées.
function realKeys() {
  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-65); // point non compressé de 65 octets
  return { p256dh: b64url(raw), auth: b64url(randomBytes(16)) };
}

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push services of the browsers", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91bXYZ",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://web.push.apple.com/QGxk9",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("refuses anything that is not https", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
  });

  it("refuses internal and arbitrary addresses (the server would send requests to them)", () => {
    for (const endpoint of [
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/x",
      "https://[::1]/x",
      "https://intranet/x",
      "https://evil.example.com/fcm.googleapis.com",
      "https://example.org/?u=fcm.googleapis.com",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  it("refuses look-alike hosts: the service name must be the end of the host name, on a dot boundary", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilfcm.googleapis.com/x",
      "https://notfcm.googleapis.com.attacker.dz/x",
      "https://push.apple.com.evil.dz/x",
      "https://xpush.apple.com/x",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  it("refuses credentials in the address, a non-standard port, and oversized values", () => {
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/fcm/send/x")).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(MAX_ENDPOINT_LENGTH)}`)).toBe(false);
    expect(isAllowedPushEndpoint("")).toBe(false);
    expect(isAllowedPushEndpoint("pas une adresse")).toBe(false);
  });
});

describe("pushSubscriptionSchema", () => {
  const keys = realKeys();
  const valid = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys };

  it("accepts what a browser sends", () => {
    expect(keys.p256dh).toHaveLength(87);
    expect(keys.auth).toHaveLength(22);
    expect(pushSubscriptionSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an unknown push service", () => {
    expect(pushSubscriptionSchema.safeParse({ ...valid, endpoint: "https://evil.example.com/x" }).success).toBe(false);
  });

  it("refuses malformed or invented keys", () => {
    for (const bad of [
      { ...keys, p256dh: "court" },
      { ...keys, p256dh: `${keys.p256dh}+` }, // caractère hors base64url
      { ...keys, auth: "x" },
      { ...keys, auth: `${keys.auth}${keys.auth}` },
    ]) {
      expect(pushSubscriptionSchema.safeParse({ ...valid, keys: bad }).success).toBe(false);
    }
    expect(pushSubscriptionSchema.safeParse({ endpoint: valid.endpoint }).success).toBe(false);
  });
});

describe("resolvePushConfig", () => {
  const publicKey = "B".repeat(87);
  const privateKey = "p".repeat(43);

  it("is disabled, without error, when nothing is configured", () => {
    expect(resolvePushConfig({})).toEqual({ mode: "disabled" });
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: " ", VAPID_PRIVATE_KEY: "" })).toEqual({ mode: "disabled" });
  });

  it("is enabled with a full valid configuration", () => {
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:contact@souqauto.example" })).toEqual({
      mode: "enabled",
      publicKey,
      privateKey,
      subject: "mailto:contact@souqauto.example",
    });
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "https://souqauto.example/contact" }).mode).toBe("enabled");
  });

  it("reports a half-configured or malformed setup as an error instead of silently disabling", () => {
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey }).mode).toBe("error");
    expect(resolvePushConfig({ VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:a@b.dz" }).mode).toBe("error");
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: "trop-court", VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:a@b.dz" }).mode).toBe("error");
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: "trop-courte", VAPID_SUBJECT: "mailto:a@b.dz" }).mode).toBe("error");
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }).mode).toBe("error");
    expect(resolvePushConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "contact@souqauto.example" }).mode).toBe("error");
  });
});

describe("buildPushPayload", () => {
  it("keeps a short notification as it is", () => {
    expect(buildPushPayload({ title: "Nouvelle annonce", body: "Renault Clio — 1 500 000 DA", url: "/fr/annonce/abc", tag: "alert-1", lang: "fr" })).toEqual({
      title: "Nouvelle annonce",
      body: "Renault Clio — 1 500 000 DA",
      url: "/fr/annonce/abc",
      tag: "alert-1",
      lang: "fr",
    });
  });

  it("bounds the title and the text so the encrypted message stays small", () => {
    const payload = buildPushPayload({ title: "T".repeat(300), body: "B".repeat(600), url: "/" });
    expect(payload.title.length).toBeLessThanOrEqual(80);
    expect(payload.body.length).toBeLessThanOrEqual(140);
    expect(payload.title.endsWith("…")).toBe(true);
    expect(JSON.stringify(payload).length).toBeLessThan(1000);
  });

  it("collapses line breaks and spaces", () => {
    expect(buildPushPayload({ title: "  A \n\n B  ", body: "x\t\ty", url: "/" })).toMatchObject({ title: "A B", body: "x y" });
  });

  it("only ever opens a path of the site, never another address", () => {
    for (const url of ["https://evil.example/", "//evil.example/", "javascript:alert(1)", "evil", ""]) {
      expect(buildPushPayload({ title: "t", body: "b", url }).url, url).toBe("/");
    }
    expect(buildPushPayload({ title: "t", body: "b", url: "/ar/annonce/x?y=1" }).url).toBe("/ar/annonce/x?y=1");
  });
});
