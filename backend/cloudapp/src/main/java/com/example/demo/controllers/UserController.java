package com.example.demo.controllers;

import com.example.demo.security.InternalRequestAuthorizer;
import com.example.demo.security.UserRoleAuthorityService;
import com.example.demo.utilities.JwtUtilities;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.*;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("user")
public class UserController {

    public static final Logger log = LoggerFactory.getLogger(UserController.class);

    @Autowired
    public UserRepository userRepository;

    @Autowired
    public CartRepository cartRepository;

    @Autowired
    public PasswordEncoder passwordEncoder;

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtilities jwtUtilities;

    @Autowired
    private InternalRequestAuthorizer internalRequestAuthorizer;

    @Autowired(required = false)
    private UserRoleAuthorityService userRoleAuthorityService;

    private static final String AUTH_COOKIE_NAME = "CLOUDAPP_AUTH";
    private static final String FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";

    private String getAuthenticatedUsername(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof User user) {
            return user.getUsername();
        }
        if (principal instanceof org.springframework.security.core.userdetails.User springUser) {
            return springUser.getUsername();
        }
        return null;
    }

    private boolean isAuthorizedUserAccess(Authentication auth, String username, HttpServletRequest request) {
        if (internalRequestAuthorizer.isInternalRequest(request)) {
            return true;
        }
        String authenticated = getAuthenticatedUsername(auth);
        return authenticated != null && authenticated.equals(username);
    }

    @GetMapping("/id/{id}")
    public ResponseEntity<User> findById(@PathVariable Long id, Authentication auth, HttpServletRequest request) {
        return userRepository.findById(id)
                .map(found -> {
                    if (!isAuthorizedUserAccess(auth, found.getUsername(), request)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<User>build();
                    }
                    return ResponseEntity.ok(found);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{username}")
    public ResponseEntity<User> findByUserName(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isAuthorizedUserAccess(auth, username, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(user);
    }

    @GetMapping("/admin/users")
    public ResponseEntity<List<String>> listUsernames() {
        List<String> usernames = userRepository.findAll().stream()
                .map(User::getUsername)
                .sorted()
                .collect(Collectors.toList());
        return ResponseEntity.ok(usernames);
    }

    @PostMapping("/admin/roles")
    public ResponseEntity<?> updateUserRoles(@RequestBody UpdateUserRolesRequest updateUserRolesRequest) {
        if (updateUserRolesRequest == null || updateUserRolesRequest.getUsername() == null
                || updateUserRolesRequest.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body("Username is required");
        }
        if (updateUserRolesRequest.getRoles() == null) {
            return ResponseEntity.badRequest().body("Roles are required");
        }

        User user = userRepository.findByUsername(updateUserRolesRequest.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        final List<String> normalizedRoles;
        try {
            normalizedRoles = normalizeAssignableRoleNames(updateUserRolesRequest.getRoles());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
        user.setRoles(normalizedRoles);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "roles", normalizedRoles
        ));
    }

    @PostMapping("/user-register")
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest createUserRequest) {
        if (createUserRequest.getUsername() == null || createUserRequest.getUsername().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (createUserRequest.getPassword() == null || createUserRequest.getConfirmPassword() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (userRepository.findByUsername(createUserRequest.getUsername()) != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        User user = new User();

        if (createUserRequest.getPassword().length() < 8) {
            log.error("password is too short");
            return ResponseEntity.badRequest().build();
        }
        if (!createUserRequest.getPassword().equals(createUserRequest.getConfirmPassword())) {
            log.error("password do not match with confirm password");
            return ResponseEntity.badRequest().build();
        }
        user.setUsername(createUserRequest.getUsername());
        user.setPassword(this.passwordEncoder.encode(createUserRequest.getPassword()));
        user.setRoles(defaultRolesForNewUser(createUserRequest.getUsername()));
        Cart cart = new Cart();
        cartRepository.save(cart);
        user.setCart(cart);
        userRepository.save(user);
        log.info("user creation successful for: " + user.getUsername());
        return ResponseEntity.ok(user);
    }

    private String buildAuthCookie(HttpServletRequest request, String token) {
        boolean secure = request.isSecure()
                || "https".equalsIgnoreCase(request.getHeader(FORWARDED_PROTO_HEADER));

        return ResponseCookie.from(AUTH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/cloudapp")
                .build()
                .toString();
    }

    private String buildClearedAuthCookie(HttpServletRequest request) {
        boolean secure = request.isSecure()
                || "https".equalsIgnoreCase(request.getHeader(FORWARDED_PROTO_HEADER));

        return ResponseCookie.from(AUTH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/cloudapp")
                .maxAge(0)
                .build()
                .toString();
    }

    @PostMapping(value = "/user-login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsername(),
                            loginRequest.getPassword()
                    )
            );
            String token = jwtUtilities.generateToken(authentication);
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.set("Authorization",
                    token);
            responseHeaders.add(HttpHeaders.SET_COOKIE, buildAuthCookie(request, token));
            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body("Response with header using ResponseEntity");
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
        }
    }

    @PostMapping("/user-logout")
    public ResponseEntity<?> logoutUser(HttpServletRequest request) {
        HttpHeaders responseHeaders = new HttpHeaders();
        responseHeaders.add(HttpHeaders.SET_COOKIE, buildClearedAuthCookie(request));
        return ResponseEntity.ok()
                .headers(responseHeaders)
                .body("Logged out");
    }

    @GetMapping("/csrf-token")
    public ResponseEntity<?> getCsrfToken(CsrfToken csrfToken) {
        return ResponseEntity.ok(Map.of(
                "token", csrfToken.getToken(),
                "headerName", csrfToken.getHeaderName(),
                "parameterName", csrfToken.getParameterName()
        ));
    }

    @GetMapping("/auth-check")
    public ResponseEntity<?> authCheck(Authentication auth) {
        String authenticatedUsername = getAuthenticatedUsername(auth);
        if (authenticatedUsername == null || authenticatedUsername.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }

        List<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .sorted()
                .toList();

        return ResponseEntity.ok(Map.of(
                "username", authenticatedUsername,
                "roles", roles
        ));
    }

    @PostMapping("/user-change-password")
    public ResponseEntity<?> changePassword(
            @RequestBody ChangePasswordRequest changePasswordRequest,
            Authentication auth
    ) {
        String authenticatedUsername = getAuthenticatedUsername(auth);
        if (authenticatedUsername == null || authenticatedUsername.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        if (changePasswordRequest == null
                || changePasswordRequest.getCurrentPassword() == null
                || changePasswordRequest.getNewPassword() == null
                || changePasswordRequest.getConfirmNewPassword() == null) {
            return ResponseEntity.badRequest().body("Current password, new password and confirm password are required");
        }

        String currentPassword = changePasswordRequest.getCurrentPassword().trim();
        String newPassword = changePasswordRequest.getNewPassword().trim();
        String confirmNewPassword = changePasswordRequest.getConfirmNewPassword().trim();

        if (currentPassword.isEmpty() || newPassword.isEmpty() || confirmNewPassword.isEmpty()) {
            return ResponseEntity.badRequest().body("Current password, new password and confirm password are required");
        }
        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body("New password must be at least 8 characters");
        }
        if (!newPassword.equals(confirmNewPassword)) {
            return ResponseEntity.badRequest().body("New password and confirm password do not match");
        }

        User user = userRepository.findByUsername(authenticatedUsername);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("password updated for: {}", user.getUsername());

        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "message", "Password updated"
        ));
    }

    private List<String> defaultRolesForNewUser(String username) {
        if (userRoleAuthorityService == null) {
            return List.of("ROLE_USER");
        }
        return userRoleAuthorityService.getBootstrapRoleNamesForUsername(username);
    }

    private List<String> normalizeRoleNames(List<String> roles) {
        if (userRoleAuthorityService == null) {
            return List.of("ROLE_USER");
        }
        return userRoleAuthorityService.normalizeRoleNames(roles);
    }

    private List<String> normalizeAssignableRoleNames(List<String> roles) {
        if (userRoleAuthorityService == null) {
            return List.of("ROLE_USER");
        }
        return userRoleAuthorityService.normalizeAssignableRoleNames(roles);
    }
}
