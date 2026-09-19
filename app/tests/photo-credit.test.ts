import { describe, expect, it } from "vitest";
import { collectPhotoCredits, safeCreditUrl, toPhotoCredit } from "@/lib/photo-credit";

const photo = (o: Partial<Record<"creditAuthor" | "creditLicense" | "creditLicenseUrl" | "creditSourceUrl", string | null>> = {}) => ({
  creditAuthor: "Alexander Migl",
  creditLicense: "CC BY-SA 4.0",
  creditLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  creditSourceUrl: "https://commons.wikimedia.org/wiki/File:Audi_Q3_F3_IMG_0911.jpg",
  ...o,
});
const none = { creditAuthor: null, creditLicense: null, creditLicenseUrl: null, creditSourceUrl: null };

describe("safeCreditUrl", () => {
  it("keeps a link to Wikimedia Commons or to a Creative Commons licence", () => {
    expect(safeCreditUrl("https://commons.wikimedia.org/wiki/File:X.jpg")).toBe("https://commons.wikimedia.org/wiki/File:X.jpg");
    expect(safeCreditUrl("https://creativecommons.org/licenses/by/4.0")).toBe("https://creativecommons.org/licenses/by/4.0");
    expect(safeCreditUrl("https://www.creativecommons.org/publicdomain/zero/1.0/")).toBe("https://www.creativecommons.org/publicdomain/zero/1.0/");
  });

  it("refuses everything else: other sites, other schemes, look-alike hosts, credentials, ports", () => {
    for (const url of [
      "http://commons.wikimedia.org/wiki/File:X.jpg",
      "https://evil.example/wiki/File:X.jpg",
      "https://commons.wikimedia.org.evil.example/x",
      "https://user:pass@commons.wikimedia.org/x",
      "https://commons.wikimedia.org:8443/x",
      "https://notcommons.wikimedia.org/x",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//commons.wikimedia.org/x",
      "commons.wikimedia.org/x",
      "",
      "pas une adresse",
    ]) {
      expect(safeCreditUrl(url), url).toBeNull();
    }
    expect(safeCreditUrl(null)).toBeNull();
    expect(safeCreditUrl(undefined)).toBeNull();
  });
});

describe("toPhotoCredit", () => {
  it("builds a credit from a photo that names its author and licence", () => {
    expect(toPhotoCredit(photo())).toEqual({
      author: "Alexander Migl",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Audi_Q3_F3_IMG_0911.jpg",
    });
  });

  it("gives nothing for a seller's own photo", () => {
    expect(toPhotoCredit(none)).toBeNull();
  });

  it("gives nothing when the author or the licence is missing or blank: CC BY needs both", () => {
    expect(toPhotoCredit(photo({ creditAuthor: null }))).toBeNull();
    expect(toPhotoCredit(photo({ creditAuthor: "   " }))).toBeNull();
    expect(toPhotoCredit(photo({ creditLicense: null }))).toBeNull();
    expect(toPhotoCredit(photo({ creditLicense: "" }))).toBeNull();
  });

  it("drops a link that is not allowed instead of displaying it, but keeps the credit", () => {
    const credit = toPhotoCredit(photo({ creditSourceUrl: "https://evil.example/x", creditLicenseUrl: "javascript:alert(1)" }));
    expect(credit).toMatchObject({ author: "Alexander Migl", license: "CC BY-SA 4.0", licenseUrl: null, sourceUrl: null });
  });

  it("trims the text", () => {
    expect(toPhotoCredit(photo({ creditAuthor: "  Dinkun Chen ", creditLicense: " CC BY-SA 4.0 " }))).toMatchObject({ author: "Dinkun Chen", license: "CC BY-SA 4.0" });
  });
});

describe("collectPhotoCredits", () => {
  it("lists the credits in photo order, skipping photos without credit", () => {
    const credits = collectPhotoCredits([none, photo(), photo({ creditAuthor: "Vauxford", creditSourceUrl: "https://commons.wikimedia.org/wiki/File:Y.jpg" })]);
    expect(credits.map((c) => c.author)).toEqual(["Alexander Migl", "Vauxford"]);
  });

  it("does not repeat the same credit twice", () => {
    expect(collectPhotoCredits([photo(), photo(), photo()])).toHaveLength(1);
  });

  it("is empty for an ad made only of sellers' photos", () => {
    expect(collectPhotoCredits([none, none])).toEqual([]);
    expect(collectPhotoCredits([])).toEqual([]);
  });
});
