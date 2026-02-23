package com.example.demo.security;

import com.example.demo.model.persistence.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class UserRoleAuthorityService {

    private static final String ROLE_USER = "ROLE_USER";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final Set<String> adminUsernames;

    public UserRoleAuthorityService(@Value("${cloudapp.security.admin-usernames:}") String adminUsernamesCsv) {
        this.adminUsernames = Arrays.stream(adminUsernamesCsv.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
    }

    public List<String> getBootstrapRoleNamesForUsername(String username) {
        LinkedHashSet<String> roles = new LinkedHashSet<>();
        roles.add(ROLE_USER);
        if (username != null && adminUsernames.contains(username)) {
            roles.add(ROLE_ADMIN);
        }
        return List.copyOf(roles);
    }

    public List<String> getRoleNamesForUsername(String username) {
        return getBootstrapRoleNamesForUsername(username);
    }

    public List<String> getRoleNamesForUser(User user) {
        if (user == null) {
            return List.of();
        }

        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            return normalizeRoleNames(user.getRoles());
        }

        return getBootstrapRoleNamesForUsername(user.getUsername());
    }

    public List<String> normalizeRoleNames(Collection<String> roleNames) {
        if (roleNames == null) {
            return List.of();
        }

        LinkedHashSet<String> normalizedRoles = new LinkedHashSet<>();
        for (String roleName : roleNames) {
            if (roleName == null || roleName.isBlank()) {
                continue;
            }
            String trimmed = roleName.trim();
            String normalized = trimmed.startsWith("ROLE_")
                    ? trimmed.toUpperCase(Locale.ROOT)
                    : "ROLE_" + trimmed.toUpperCase(Locale.ROOT);
            normalizedRoles.add(normalized);
        }

        // Keep a base role on every authenticated user even if admin input omits it.
        normalizedRoles.add(ROLE_USER);
        return List.copyOf(normalizedRoles);
    }

    public Collection<? extends GrantedAuthority> getAuthoritiesForUser(User user) {
        return getAuthoritiesFromRoleNames(getRoleNamesForUser(user));
    }

    public Collection<? extends GrantedAuthority> getAuthoritiesForUsername(String username) {
        return getAuthoritiesFromRoleNames(getRoleNamesForUsername(username));
    }

    public List<GrantedAuthority> getAuthoritiesFromRoleNames(List<String> roleNames) {
        List<String> normalizedRoles = normalizeRoleNames(roleNames);
        if (normalizedRoles.isEmpty()) {
            return List.of();
        }

        return normalizedRoles.stream()
                .<GrantedAuthority>map(SimpleGrantedAuthority::new)
                .toList();
    }
}
