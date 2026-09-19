import { describe, expect, it } from "vitest";
import { buildTelUrl, buildWhatsappMessage, buildWhatsappUrl, toInternationalDigits } from "@/lib/contact-links";

describe("toInternationalDigits", () => {
  it("converts the local mobile format to international digits", () => {
    expect(toInternationalDigits("0555123456")).toBe("213555123456");
    expect(toInternationalDigits("0655123456")).toBe("213655123456");
    expect(toInternationalDigits("0755123456")).toBe("213755123456");
  });

  it("keeps a number already written with +213", () => {
    expect(toInternationalDigits("+213555123456")).toBe("213555123456");
  });

  it("trims surrounding spaces", () => {
    expect(toInternationalDigits("  0555123456 ")).toBe("213555123456");
  });

  it("refuses anything that is not an Algerian mobile number", () => {
    for (const value of ["", "abc", "0155123456", "055512345", "05551234567", "+33612345678", "0555 12 34 56", "+2130555123456", "555123456"]) {
      expect(toInternationalDigits(value), value).toBeNull();
    }
  });
});

describe("buildTelUrl", () => {
  it("builds an international tel: link", () => {
    expect(buildTelUrl("0555123456")).toBe("tel:+213555123456");
    expect(buildTelUrl("+213555123456")).toBe("tel:+213555123456");
  });

  it("returns null for an invalid number instead of a broken link", () => {
    expect(buildTelUrl("n'importe quoi")).toBeNull();
  });
});

describe("buildWhatsappMessage", () => {
  const input = { title: "Renault Clio 4 diesel 2018", url: "https://souqauto.example/fr/annonce/abc" };

  it("names the listing and links to it, in French", () => {
    const message = buildWhatsappMessage({ ...input, locale: "fr" });
    expect(message).toContain("« Renault Clio 4 diesel 2018 »");
    expect(message).toContain("https://souqauto.example/fr/annonce/abc");
    expect(message.startsWith("Bonjour")).toBe(true);
  });

  it("is written in Arabic for the Arabic site", () => {
    const message = buildWhatsappMessage({ ...input, locale: "ar" });
    expect(message).toContain("«Renault Clio 4 diesel 2018»");
    expect(message).toContain("سوق أوتو");
    expect(message).toContain("https://souqauto.example/fr/annonce/abc");
  });
});

describe("buildWhatsappUrl", () => {
  it("targets the international number with the message URL-encoded", () => {
    const url = buildWhatsappUrl("0555123456", "Bonjour & merci : « test »");
    expect(url).toBe(`https://wa.me/213555123456?text=${encodeURIComponent("Bonjour & merci : « test »")}`);
    expect(new URL(url!).searchParams.get("text")).toBe("Bonjour & merci : « test »");
  });

  it("cannot be steered to another number or host by the message text", () => {
    const url = buildWhatsappUrl("0555123456", "x&phone=213600000000/../evil");
    expect(url!.startsWith("https://wa.me/213555123456?text=")).toBe(true);
    expect(new URL(url!).hostname).toBe("wa.me");
    expect(new URL(url!).searchParams.get("phone")).toBeNull();
  });

  it("returns null for an invalid number", () => {
    expect(buildWhatsappUrl("123", "Bonjour")).toBeNull();
  });
});
