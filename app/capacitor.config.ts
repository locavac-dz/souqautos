import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.souqauto.app",
  appName: "Souq Auto",
  // webDir est requis par Capacitor mais non utilisé en mode server.url
  webDir: "out",
  server: {
    // Remplacer par l'URL de production une fois le serveur déployé.
    // En développement local sur émulateur Android : "http://10.0.2.2:3000"
    url: "https://souqauto.com",
    cleartext: false,
    // Autoriser la navigation entre sous-domaines du site
    allowNavigation: ["*.souqauto.com"],
  },
  android: {
    // Permettre les cookies tiers (nécessaire pour l'auth Google OAuth)
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
