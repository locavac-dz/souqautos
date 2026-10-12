"use client";

// Lot 293 — envoie une erreur du navigateur au serveur (POST /api/errors/report).
// Appelé depuis les error boundaries (error.tsx). Ne lève jamais d'exception.
export function reportClientError(error: Error & { digest?: string }): void {
  try {
    const body = JSON.stringify({
      message: error.message?.slice(0, 500) ?? "Unknown error",
      stack: error.stack?.slice(0, 4000),
      digest: error.digest,
      route: typeof window !== "undefined" ? window.location.pathname : null,
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/errors/report", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/errors/report", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // volontairement silencieux
  }
}
