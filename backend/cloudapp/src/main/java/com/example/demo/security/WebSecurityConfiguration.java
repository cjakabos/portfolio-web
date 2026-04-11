package com.example.demo.security;

// ===========================================================================
// Replaced IP-based internal auth bypass with service-to-service
// token validation. The old approach granted unauthenticated access to any
// request from 172.x.x.x or 10.x.x.x — which would bypass JWT in any cloud
// VPC where all traffic originates from private IPs.
//
// New approach: Internal services must send explicit internal service identity
// headers. Each internal caller now has its
// own token and service name instead of sharing one repo-wide bypass secret.
// ===========================================================================

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import java.util.Set;

@Configuration
@EnableWebSecurity
public class WebSecurityConfiguration {

    @Autowired
    private JWTAuthenticationVerificationFilter authenticationTokenFilter;

    @Autowired
    private InternalServiceAuthenticationFilter internalServiceAuthenticationFilter;

    @Autowired
    private InternalRequestAuthorizer internalRequestAuthorizer;

    // Do not remove, needed for UserDetailsServiceImpl to work
    @Autowired
    private final UserDetailsServiceImpl userDetailsService;
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "TRACE", "OPTIONS");

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    public WebSecurityConfiguration(UserDetailsServiceImpl userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    private static final String[] AUTH_WHITELIST_SWAGGER = {
            "/swagger-ui/**",
            "/cloudapp/swagger-ui/**",
            "/v3/api-docs/**",
            "/cloudapp/v3/api-docs/**",
            "/swagger-ui.html"
    };

    private static final String[] AUTH_WHITELIST = {
            "/ws/**",
            "/cloudapp/ws/**",
            "/actuator/**"
            ,"/cloudapp/actuator/**"
    };

    private static final String[] PUBLIC_AUTH_POSTS = {
            "/user/user-register",
            "/cloudapp/user/user-register",
            "/user/user-login",
            "/cloudapp/user/user-login",
            "/user/user-logout",
            "/cloudapp/user/user-logout"
    };

    private static final String[] ADMIN_USER_PATHS = {
            "/user/admin/**",
            "/cloudapp/user/admin/**"
    };

    private static final String[] ADMIN_ITEM_POSTS = {
            "/item",
            "/cloudapp/item"
    };

    private static final String[] ADMIN_ITEM_MUTATIONS = {
            "/item/**",
            "/cloudapp/item/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf
                .csrfTokenRepository(csrfTokenRepository())
                // CloudApp shell sends the raw cookie token value back in X-XSRF-TOKEN.
                // Use the plain handler so SPA-style submissions validate consistently.
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                // During migration, require CSRF only for cookie-authenticated/browser-style
                // unsafe requests. Header-auth clients keep working without CSRF.
                .requireCsrfProtectionMatcher(this::requiresCsrfProtection)
        );
        http.sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        );
        http.authorizeHttpRequests(authHttpRequests -> authHttpRequests
                .requestMatchers(HttpMethod.POST, PUBLIC_AUTH_POSTS).permitAll()
                .requestMatchers(HttpMethod.GET, AUTH_WHITELIST_SWAGGER).permitAll()
                .requestMatchers(AUTH_WHITELIST).permitAll()
                .requestMatchers(ADMIN_USER_PATHS).hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, ADMIN_ITEM_POSTS).hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, ADMIN_ITEM_MUTATIONS).hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, ADMIN_ITEM_MUTATIONS).hasRole("ADMIN")
                .anyRequest()
                .authenticated()
        );

        // Register both custom filters relative to a Spring Security filter that
        // already has a known order. Internal service auth runs first so JWT
        // verification can no-op when the request is already authenticated.
        http.addFilterBefore(internalServiceAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(authenticationTokenFilter, InternalServiceAuthenticationFilter.class);
        return http.build();
    }

    private boolean requiresCsrfProtection(HttpServletRequest request) {
        if (SAFE_METHODS.contains(request.getMethod())) {
            return false;
        }
        if (internalRequestAuthorizer.isInternalRequest(request)) {
            return false;
        }

        String requestUri = request.getRequestURI();
        String servletPath = request.getServletPath();
        if (endsWithAnyPath(
                requestUri,
                servletPath,
                "/user/user-register",
                "/user/user-login",
                "/user/user-logout"
        )) {
            return false;
        }

        String authorizationHeader = request.getHeader(SecurityConstants.HEADER_STRING);
        return authorizationHeader == null || authorizationHeader.isBlank();
    }

    private boolean endsWithAnyPath(String requestUri, String servletPath, String... suffixes) {
        for (String suffix : suffixes) {
            if ((requestUri != null && requestUri.endsWith(suffix))
                    || (servletPath != null && servletPath.endsWith(suffix))) {
                return true;
            }
        }
        return false;
    }

    @Bean
    CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieName("XSRF-TOKEN");
        repository.setHeaderName("X-XSRF-TOKEN");
        repository.setCookiePath("/cloudapp");
        repository.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
        return repository;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
