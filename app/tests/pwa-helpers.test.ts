import { describe, expect, it } from "vitest";
import { decideInstallOffer, isIosDevice, isStandaloneDisplay } from "@/lib/pwa";

describe("isIosDevice", () => {
  it("recognises iPhone, iPad and iPod", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)")).toBe(true);
  });

  it("recognises a recent iPad that presents itself as a Mac, by its touch screen", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(isIosDevice(mac, 5)).toBe(true);
    expect(isIosDevice(mac, 0)).toBe(false); // un vrai Mac
  });

  it("does not take Android or desktop browsers for iOS", () => {
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36")).toBe(false);
  });
});

describe("isStandaloneDisplay", () => {
  it("is true when opened as an installed application, on any platform", () => {
    expect(isStandaloneDisplay({ displayModeStandalone: true, iosStandalone: undefined })).toBe(true);
    expect(isStandaloneDisplay({ displayModeStandalone: false, iosStandalone: true })).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    expect(isStandaloneDisplay({ displayModeStandalone: false, iosStandalone: undefined })).toBe(false);
    expect(isStandaloneDisplay({ displayModeStandalone: false, iosStandalone: false })).toBe(false);
  });
});

describe("decideInstallOffer", () => {
  it("offers nothing when the app is already installed, whatever else is true", () => {
    expect(decideInstallOffer({ standalone: true, hasPrompt: true, ios: true })).toBe("none");
  });

  it("offers a button when the browser provided the install prompt", () => {
    expect(decideInstallOffer({ standalone: false, hasPrompt: true, ios: false })).toBe("button");
  });

  it("explains how to install on iOS, where there is no prompt", () => {
    expect(decideInstallOffer({ standalone: false, hasPrompt: false, ios: true })).toBe("ios-hint");
  });

  it("offers nothing where the app cannot be installed", () => {
    expect(decideInstallOffer({ standalone: false, hasPrompt: false, ios: false })).toBe("none");
  });
});
