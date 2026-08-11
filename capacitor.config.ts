import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.remote.universal",
  appName: "Smart TV Remote",
  webDir: "mobile-dist",
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
