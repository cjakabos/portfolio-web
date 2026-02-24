import axios from "axios";

export const CLOUDAPP_CSRF_COOKIE_NAME = "XSRF-TOKEN";
export const CLOUDAPP_CSRF_HEADER_NAME = "X-XSRF-TOKEN";

export const getCloudAppApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";

  const cookiePrefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix));

  if (!match) return "";

  try {
    return decodeURIComponent(match.slice(cookiePrefix.length));
  } catch {
    return match.slice(cookiePrefix.length);
  }
};

export const getCloudAppCsrfTokenFromCookie = () => readCookie(CLOUDAPP_CSRF_COOKIE_NAME);

export const ensureCloudAppCsrfToken = async (apiUrl = getCloudAppApiUrl()) => {
  const existingToken = getCloudAppCsrfTokenFromCookie();
  if (existingToken) {
    return existingToken;
  }

  const response = await axios.get(`${apiUrl}/user/csrf-token`, {
    withCredentials: true,
  });

  const responseToken =
    typeof response?.data?.token === "string" ? response.data.token.trim() : "";
  if (responseToken) {
    return responseToken;
  }

  return getCloudAppCsrfTokenFromCookie();
};

export const getCloudAppCsrfHeaders = async (apiUrl = getCloudAppApiUrl()) => {
  const token = await ensureCloudAppCsrfToken(apiUrl);
  if (!token) {
    return {};
  }

  return {
    [CLOUDAPP_CSRF_HEADER_NAME]: token,
  };
};
