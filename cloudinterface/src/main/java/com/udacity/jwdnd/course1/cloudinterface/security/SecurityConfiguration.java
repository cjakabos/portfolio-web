package com.udacity.jwdnd.course1.cloudinterface.security;

import com.udacity.jwdnd.course1.cloudinterface.services.AuthenticationService;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.*;

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
        http.authorizeRequests()
                .antMatchers("/signup", "/css/**", "/js/**").permitAll()
                .anyRequest().authenticated()
                .and()
                    .logout()
                        .deleteCookies("remove")
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/login?logout");

        http.formLogin()
                .loginPage("/login")
                .permitAll()
                .defaultSuccessUrl("/home", true);
    }
}
