package com.example.demo.security;

/**
 * FIX 4.1: Removed hardcoded JWT secret ("oursecretkey") and 10-day expiration.
 * Secret is now REQUIRED via JWT_SECRET env var — app fails fast if missing.
 * Expiration reduced to 4 hours (configurable via JWT_EXPIRATION_MS).
 */
public class SecurityConstants {

    public static final String SECRET = getRequiredEnv("JWT_SECRET");

    public static final long EXPIRATION_TIME = Long.parseLong(
            System.getenv().getOrDefault("JWT_EXPIRATION_MS", "14400000") // 4 hours
    );

    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String HEADER_STRING = "Authorization";
    public static final String SIGN_UP_URL = "/cloudapp/user/user-register";

    private static String getRequiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                "Required environment variable " + name + " is not set. "
              + "Add it to your .env file or pass it via docker-compose."
            );
        }
        return value;
    }
}
