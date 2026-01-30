package com.example.demo.security;

import java.io.IOException;
import java.util.ArrayList;

import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.utilities.JwtUtilities;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.stereotype.Component;

import com.auth0.jwt.JWT;
import org.springframework.web.filter.OncePerRequestFilter;

import static com.auth0.jwt.algorithms.Algorithm.HMAC512;

@Component
public class JWTAuthenticationVerificationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtilities jwtUtilities;

    @Autowired
    private UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        // Get jwt token from header
        var authHeader = request.getHeader(SecurityConstants.HEADER_STRING);

        // Skip if no header or doesn't start with Bearer
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        var token = authHeader.substring(7); // Use substring instead of replace

        // Skip if token is empty
        if (token.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }

        try {
            var username = jwtUtilities.getSubject(token);
            if (username != null) {
                User user = userRepository.findByUsername(username);
                if (user != null) {
                    var authentication = new UsernamePasswordAuthenticationToken(user, null, new ArrayList<>());
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