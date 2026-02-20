package com.example.demo.controllers;

import com.example.demo.utilities.JwtUtilities;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.*;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

    @GetMapping("/id/{id}")
    public ResponseEntity<User> findById(@PathVariable Long id, Authentication auth) {
        return userRepository.findById(id)
                .map(found -> {
                    String authenticated = getAuthenticatedUsername(auth);
                    if (authenticated == null || !authenticated.equals(found.getUsername())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<User>build();
                    }
                    return ResponseEntity.ok(found);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{username}")
    public ResponseEntity<User> findByUserName(@PathVariable String username, Authentication auth) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        String authenticated = getAuthenticatedUsername(auth);
        if (authenticated == null || !authenticated.equals(username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(user);
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
        Cart cart = new Cart();
        cartRepository.save(cart);
        user.setCart(cart);
        userRepository.save(user);
        log.info("user creation successful for: " + user.getUsername());
        return ResponseEntity.ok(user);
    }

    @PostMapping(value = "/user-login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
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
            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body("Response with header using ResponseEntity");
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
        }
    }
}
