package com.example.demo.security;

import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.utilities.JwtUtilities;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CloudappAccessPolicy {

    private static final String AUTH_COOKIE_NAME = "CLOUDAPP_AUTH";
    private static final String BEARER_PREFIX = "Bearer ";

    private final InternalRequestAuthorizer internalRequestAuthorizer;
    private final JwtUtilities jwtUtilities;
    private final UserRepository userRepository;

    public CloudappAccessPolicy(
            InternalRequestAuthorizer internalRequestAuthorizer,
            JwtUtilities jwtUtilities,
            UserRepository userRepository
    ) {
        this.internalRequestAuthorizer = internalRequestAuthorizer;
        this.jwtUtilities = jwtUtilities;
        this.userRepository = userRepository;
    }

    public boolean isInternalRequest(HttpServletRequest request) {
        return internalRequestAuthorizer.isInternalRequest(request);
    }

    public Optional<String> resolveAuthenticatedUsername(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return Optional.ofNullable(user.getUsername());
        }
        if (principal instanceof org.springframework.security.core.userdetails.User springUser) {
            return Optional.ofNullable(springUser.getUsername());
        }
        return Optional.empty();
    }

    public Optional<String> resolveAuthenticatedUsername(
            Authentication authentication,
            HttpServletRequest request
    ) {
        Optional<String> fromAuthentication = resolveAuthenticatedUsername(authentication)
                .filter(username -> !username.isBlank());
        if (fromAuthentication.isPresent()) {
            return fromAuthentication;
        }
        return resolveUsernameFromRequest(request);
    }

    public Optional<User> resolveAuthenticatedUser(Authentication authentication, HttpServletRequest request) {
        return resolveAuthenticatedUsername(authentication, request)
                .map(userRepository::findByUsername)
                .filter(user -> user != null);
    }

    public boolean canAccessUsername(Authentication authentication, HttpServletRequest request, String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        if (isInternalRequest(request)) {
            return true;
        }
        return resolveAuthenticatedUsername(authentication, request)
                .map(username::equals)
                .orElse(false);
    }

    public boolean canAccessUserId(Authentication authentication, HttpServletRequest request, Long userId) {
        if (userId == null) {
            return false;
        }
        if (isInternalRequest(request)) {
            return true;
        }
        return resolveAuthenticatedUser(authentication, request)
                .map(user -> userId.equals(user.getId()))
                .orElse(false);
    }

    private Optional<String> resolveUsernameFromRequest(HttpServletRequest request) {
        if (request == null) {
            return Optional.empty();
        }

        String rawHeader = request.getHeader(SecurityConstants.HEADER_STRING);
        if (rawHeader != null && !rawHeader.isBlank()) {
            String token = rawHeader.trim();
            if (token.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
                token = token.substring(BEARER_PREFIX.length()).trim();
            }
            if (!token.isBlank()) {
                try {
                    return Optional.ofNullable(jwtUtilities.getSubject(token));
                } catch (Exception ignored) {
                    // Fall back to the auth cookie when the bearer token cannot be parsed.
                }
            }
        }

        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }

        for (Cookie cookie : cookies) {
            if (!AUTH_COOKIE_NAME.equals(cookie.getName())) {
                continue;
            }

            String token = cookie.getValue();
            if (token == null || token.isBlank()) {
                return Optional.empty();
            }
            try {
                return Optional.ofNullable(jwtUtilities.getSubject(token.trim()));
            } catch (Exception ignored) {
                return Optional.empty();
            }
        }

        return Optional.empty();
    }
}
