import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAP_SERVER_URL?.trim();
const capWebDir = process.env.CAP_WEB_DIR?.trim() || ".next";

const config: CapacitorConfig = {
  appId: "com.portfolio.cloudapp",
  appName: "CloudApp",
  webDir: capWebDir,
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
