package com.example.demo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

@Component
public class InternalServiceAuthenticationFilter extends OncePerRequestFilter {

    private final InternalRequestAuthorizer internalRequestAuthorizer;

    public InternalServiceAuthenticationFilter(InternalRequestAuthorizer internalRequestAuthorizer) {
        this.internalRequestAuthorizer = internalRequestAuthorizer;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            internalRequestAuthorizer.resolveIdentity(request).ifPresent(identity -> {
                Set<SimpleGrantedAuthority> authorities = new HashSet<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_INTERNAL_SERVICE"));
                for (String scope : identity.scopes()) {
                    authorities.add(new SimpleGrantedAuthority("SCOPE_" + normalizeScope(scope)));
                }
                User principal = new User(identity.serviceName(), "", authorities);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }

        filterChain.doFilter(request, response);
    }

    private String normalizeScope(String scope) {
        return scope.toUpperCase().replace('.', '_');
    }
}
