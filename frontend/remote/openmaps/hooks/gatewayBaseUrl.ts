const androidNativeGatewayBaseUrl = 'http://localhost:8080';
const defaultGatewayBaseUrl = 'http://localhost:80';

const isNativeAndroidRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const capacitor = (window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      platform?: string;
    };
  }).Capacitor;

  if (!capacitor) {
    return false;
  }

  try {
    if (typeof capacitor.getPlatform === 'function') {
      return capacitor.getPlatform() === 'android';
    }

    if (typeof capacitor.platform === 'string') {
      return capacitor.platform === 'android';
    }

    if (typeof capacitor.isNativePlatform === 'function') {
      return capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent);
    }
  } catch {
    return false;
  }

  return false;
};

export const getGatewayBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_GATEWAY_BASE_URL) {
    return process.env.NEXT_PUBLIC_GATEWAY_BASE_URL;
  }

  return isNativeAndroidRuntime() ? androidNativeGatewayBaseUrl : defaultGatewayBaseUrl;
};
