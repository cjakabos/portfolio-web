package com.example.demo.security;

// ===========================================================================
// Replaced IP-based internal auth bypass with service-to-service
// token validation. The old approach granted unauthenticated access to any
// request from 172.x.x.x or 10.x.x.x — which would bypass JWT in any cloud
// VPC where all traffic originates from private IPs.
//
// New approach: Internal services must send a shared secret in the
// X-Internal-Auth header. The token is read from the INTERNAL_SERVICE_TOKEN
// environment variable at startup. If the env var is not set, internal auth
// is disabled (all requests go through normal JWT validation).
// ===========================================================================

import com.example.demo.model.persistence.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class WebSecurityConfiguration {

    @Autowired
    private JWTAuthenticationVerificationFilter authenticationTokenFilter;

    // Do not remove, needed for UserDetailsServiceImpl to work
    @Autowired
    private final UserDetailsServiceImpl userDetailsService;

    // Service-to-service token from environment variable.
    // Set INTERNAL_SERVICE_TOKEN in docker-compose for all services that need
    // to communicate internally without JWT (e.g., NGINX health checks,
    // inter-service calls). If not set, this filter chain is effectively disabled.
    @Value("${INTERNAL_SERVICE_TOKEN:}")
    private String internalServiceToken;

    private static final String INTERNAL_AUTH_HEADER = "X-Internal-Auth";

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    public WebSecurityConfiguration(UserDetailsServiceImpl userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    private static final String[] AUTH_WHITELIST_SWAGGER = {
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/swagger-ui.html"
    };

    private static final String[] AUTH_WHITELIST = {
            "/ws/**",
            "/actuator/**"
    };

    // Check for service-to-service token instead of IP address.
    // This is safe in cloud VPCs because it requires a secret that only
    // authorized services possess, rather than relying on network topology.
    private boolean isInternalRequest(jakarta.servlet.http.HttpServletRequest request) {
        if (internalServiceToken == null || internalServiceToken.isBlank()) {
            // No token configured — disable internal auth bypass entirely.
            // All requests must go through JWT validation.
            return false;
        }
        String authHeader = request.getHeader(INTERNAL_AUTH_HEADER);
        return internalServiceToken.equals(authHeader);
    }

    // This filter chain handles internal service-to-service requests - no JWT required
    // Services must present the shared token in the X-Internal-Auth header.
    @Bean
    @Order(1)
    public SecurityFilterChain internalNetworkFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher(request -> isInternalRequest(request))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );
        // No JWT filter added here
        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable);
        http.sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        );
        http.authorizeHttpRequests(authHttpRequests -> authHttpRequests
                .requestMatchers(HttpMethod.POST,"/user/user-register", "/user/user-login", "/user/user-logout").permitAll()
                .requestMatchers(HttpMethod.GET, AUTH_WHITELIST_SWAGGER).permitAll()
                .requestMatchers(AUTH_WHITELIST).permitAll()
                .anyRequest()
                .authenticated()
        );

        http.addFilterBefore(authenticationTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
