import { prisma } from "@/lib/prisma";

export type LoginMethod = "password" | "google" | "totp";

export type LoginEventItem = {
  id: string;
  ip: string;
  browser: string;
  os: string;
  method: LoginMethod;
  success: boolean;
  createdAt: Date;
};

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Navigateur inconnu";
}

function parseOS(ua: string): string {
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "";
}

export async function recordLoginEvent(data: {
  userId: string;
  ip: string;
  userAgent: string;
  method: LoginMethod;
  success: boolean;
}): Promise<void> {
  try {
    await prisma.loginEvent.create({ data });
  } catch (err) {
    console.error(`[login-event] enregistrement échoué : ${(err as Error).message}`);
  }
}

export async function getLoginHistory(userId: string, limit = 10): Promise<LoginEventItem[]> {
  const rows = await prisma.loginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, ip: true, userAgent: true, method: true, success: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    ip: r.ip,
    browser: parseBrowser(r.userAgent),
    os: parseOS(r.userAgent),
    method: r.method as LoginMethod,
    success: r.success,
    createdAt: r.createdAt,
  }));
}
