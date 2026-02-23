package com.example.demo.security;

import java.io.IOException;
import java.util.List;

import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.utilities.JwtUtilities;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JWTAuthenticationVerificationFilter extends OncePerRequestFilter {
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String AUTH_COOKIE_NAME = "CLOUDAPP_AUTH";

    @Autowired
    private JwtUtilities jwtUtilities;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleAuthorityService userRoleAuthorityService;

    private String extractJwtToken(HttpServletRequest request) {
        String authHeader = request.getHeader(SecurityConstants.HEADER_STRING);
        if (authHeader != null && !authHeader.isBlank()) {
            String headerToken = authHeader.trim();
            if (headerToken.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
                return headerToken.substring(BEARER_PREFIX.length()).trim();
            }
            return headerToken;
        }

        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (AUTH_COOKIE_NAME.equals(cookie.getName())) {
                String cookieToken = cookie.getValue();
                if (cookieToken != null && !cookieToken.isBlank()) {
                    return cookieToken.trim();
                }
                return null;
            }
        }

        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        var token = extractJwtToken(request);

        // Skip if token is empty
        if (token == null || token.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }

        try {
            var username = jwtUtilities.getSubject(token);
            if (username != null) {
                User user = userRepository.findByUsername(username);
                if (user != null) {
                    List<String> tokenRoles = jwtUtilities.getRoles(token);
                    var authorities = tokenRoles.isEmpty()
                            ? userRoleAuthorityService.getAuthoritiesForUser(user)
                            : userRoleAuthorityService.getAuthoritiesFromRoleNames(tokenRoles);
                    var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (Exception e) {
            // Invalid token - just log and continue without authentication
            // Spring Security will deny access to protected routes
            logger.warn("JWT validation failed: " + e.getMessage());
        }

        chain.doFilter(request, response);
    }
}
