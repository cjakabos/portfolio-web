package com.udacity.jwdnd.course1.cloudinterface.security;

import com.udacity.jwdnd.course1.cloudinterface.services.AuthenticationService;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.*;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import javax.servlet.http.HttpServletRequest;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration extends WebSecurityConfigurerAdapter {
    private AuthenticationService authenticationService;

    public SecurityConfiguration(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        auth.authenticationProvider(this.authenticationService);
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {

        // Build the request matcher for CSFR protection
        RequestMatcher csrfRequestMatcher = new RequestMatcher() {

            // Disable CSFR protection on the following urls:
            private AntPathRequestMatcher[] requestMatchers = {
                    new AntPathRequestMatcher("/signup/***"),
            };

            @Override
            public boolean matches(HttpServletRequest request) {
                // If the request match one url the CSFR protection will be disabled
                for (AntPathRequestMatcher rm : requestMatchers) {
                    if (rm.matches(request)) { return false; }
                }
                return true;
            } // method matches

        }; // new RequestMatcher



        http
            .authorizeRequests()
                .antMatchers("/signup","/signup/api","/css/**", "/js/**").permitAll()
                .anyRequest().authenticated()
                .and()
                .logout()
                .deleteCookies("remove")
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout");


        http.csrf()
                .ignoringAntMatchers("/signup/api", "/api/b")
                .and()
                .formLogin()
                .loginPage("/login")
                .permitAll()
                .defaultSuccessUrl("/home", true);

    }
}
