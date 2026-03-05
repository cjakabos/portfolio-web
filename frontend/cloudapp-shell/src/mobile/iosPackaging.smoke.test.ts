import fs from "node:fs";
import path from "node:path";

import capacitorConfig from "../../capacitor.config";

const webRootDir = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(webRootDir, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("iOS packaging smoke", () => {
  it("keeps required capacitor iOS dependencies", () => {
    expect(packageJson.dependencies?.["@capacitor/core"]).toBeTruthy();
    expect(packageJson.dependencies?.["@capacitor/ios"]).toBeTruthy();
    expect(packageJson.devDependencies?.["@capacitor/cli"]).toBeTruthy();
  });

  it("keeps iOS workflow scripts available", () => {
    expect(packageJson.scripts?.["mobile:add:ios"]).toContain("npx cap add ios");
    expect(packageJson.scripts?.["mobile:ios"]).toContain("npx cap open ios");
  });

  it("uses a valid capacitor base config for iOS wrapper builds", () => {
    expect(capacitorConfig.appId).toBe("com.portfolio.cloudapp");
    expect(capacitorConfig.appName).toBe("CloudApp");
    expect(capacitorConfig.webDir).toBe(".next");
  });
});
