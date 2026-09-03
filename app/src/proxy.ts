import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Renommé "proxy" (Next.js 16 a déprécié le fichier middleware.ts au profit de proxy.ts,
// même comportement, cf. node_modules/next/dist/docs/.../proxy.md).
export function proxy(request: Parameters<typeof handleI18nRouting>[0]) {
  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
