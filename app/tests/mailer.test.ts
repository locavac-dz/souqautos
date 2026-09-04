import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/mailer";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;"
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Renault Clio 4 diesel")).toBe("Renault Clio 4 diesel");
  });

  it("escapes ampersands first so entities are never double-escaped", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("escapes a realistic message injection attempt", () => {
    const malicious = `Bonjour <img src=x onerror="alert(1)">`;
    expect(escapeHtml(malicious)).toBe(
      "Bonjour &lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });
});
