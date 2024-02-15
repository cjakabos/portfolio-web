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
        if (authHeader != null) {
            var token = authHeader.replace("Bearer ", "");
            var username = jwtUtilities.getSubject(token); // extract username
            if (username != null) { // Valid token
                User user = userRepository.findByUsername(username);
                if (user != null) {
                    var authentication = new UsernamePasswordAuthenticationToken(user, null, new ArrayList<>());
                    //var authentication = new UsernamePasswordAuthenticationToken(user, null,
                    //user.getAuthorities()); // Forced login
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }
        chain.doFilter(request, response);
    }

}
