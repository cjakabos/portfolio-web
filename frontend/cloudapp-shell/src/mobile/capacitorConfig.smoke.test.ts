const originalCapServerUrl = process.env.CAP_SERVER_URL;

const restoreCapServerUrl = () => {
  if (typeof originalCapServerUrl === "string") {
    process.env.CAP_SERVER_URL = originalCapServerUrl;
    return;
  }
  delete process.env.CAP_SERVER_URL;
};

const loadConfig = () => {
  jest.resetModules();
  const mod = require("../../capacitor.config");
  return mod.default;
};

afterEach(() => {
  restoreCapServerUrl();
  jest.resetModules();
});

describe("Capacitor config mobile smoke", () => {
  it("defaults to bundled mode when CAP_SERVER_URL is unset", () => {
    delete process.env.CAP_SERVER_URL;
    const config = loadConfig();

    expect(config.appId).toBe("com.portfolio.cloudapp");
    expect(config.appName).toBe("CloudApp");
    expect(config.webDir).toBe(".next");
    expect(config.server).toBeUndefined();
  });

  it("enables hosted mode with https CAP_SERVER_URL", () => {
    process.env.CAP_SERVER_URL = "https://app.example.com";
    const config = loadConfig();

    expect(config.server).toEqual({
      url: "https://app.example.com",
      cleartext: false,
    });
  });

  it("enables cleartext flag for http CAP_SERVER_URL", () => {
    process.env.CAP_SERVER_URL = "http://10.0.2.2:5001";
    const config = loadConfig();

    expect(config.server).toEqual({
      url: "http://10.0.2.2:5001",
      cleartext: true,
    });
  });
});
