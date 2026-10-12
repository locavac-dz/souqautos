export function maskSensitive(text: string): string {
  return text
    .replace(/[^\s@'"<>()]+@[^\s@'"<>()]+\.[^\s@'"<>()]+/g, "[e-mail]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[numéro]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[…]");
}
