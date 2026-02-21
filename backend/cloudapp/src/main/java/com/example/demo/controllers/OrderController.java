package com.example.demo.controllers;

import com.example.demo.security.InternalRequestAuthorizer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("order")
public class OrderController {

    public static final Logger log = LoggerFactory.getLogger(OrderController.class);

    @Autowired
    public UserRepository userRepository;

    @Autowired
    public OrderRepository orderRepository;

    @Autowired
    private InternalRequestAuthorizer internalRequestAuthorizer;

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

    private boolean isAuthorized(Authentication auth, String username, HttpServletRequest request) {
        if (internalRequestAuthorizer.isInternalRequest(request)) {
            return true;
        }
        String authenticated = getAuthenticatedUsername(auth);
        return authenticated != null && authenticated.equals(username);
    }

    @PostMapping("/submit/{username}")
    public ResponseEntity<UserOrder> submit(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.error("User not found during order submit: " + username);
            return ResponseEntity.notFound().build();
        }
        if (!isAuthorized(auth, username, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        UserOrder order = UserOrder.createFromCart(user.getCart());
        orderRepository.save(order);
        log.info("Userorder creation successful for : " + user.getUsername());
        return ResponseEntity.ok(order);
    }

    @GetMapping("/history/{username}")
    public ResponseEntity<List<UserOrder>> getOrdersForUser(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.error("User not found during order history: " + username);
            return ResponseEntity.notFound().build();
        }
        if (!isAuthorized(auth, username, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        log.info("User order history fetch is successful for : " + user.getUsername());
        return ResponseEntity.ok(orderRepository.findByUser(user));
    }
}
