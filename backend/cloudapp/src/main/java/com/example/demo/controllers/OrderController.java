package com.example.demo.controllers;

import com.example.demo.security.InternalRequestAuthorizer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import com.example.demo.model.persistence.*;
import com.example.demo.model.service.inf.IOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("order")
public class OrderController {

    public static final Logger log = LoggerFactory.getLogger(OrderController.class);

    private final IOrderService orderService;

    private final InternalRequestAuthorizer internalRequestAuthorizer;

    public OrderController(IOrderService orderService, InternalRequestAuthorizer internalRequestAuthorizer) {
        this.orderService = orderService;
        this.internalRequestAuthorizer = internalRequestAuthorizer;
    }

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

    private void logForbidden(String action, String username, Authentication auth) {
        log.warn(
                "Rejected {} request for username={} from authenticatedUser={}",
                action,
                username,
                getAuthenticatedUsername(auth));
    }

    private <T> ResponseEntity<T> notFound(String action, String username) {
        log.warn("User not found during {} for username={}", action, username);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @PostMapping("/submit/{username}")
    public ResponseEntity<UserOrder> submit(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (!orderService.userExists(username)) {
            return notFound("order-submit", username);
        }
        if (!isAuthorized(auth, username, request)) {
            logForbidden("order-submit", username, auth);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(orderService.submit(username));
    }

    @GetMapping("/history/{username}")
    public ResponseEntity<List<UserOrder>> getOrdersForUser(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (!orderService.userExists(username)) {
            return notFound("order-history", username);
        }
        if (!isAuthorized(auth, username, request)) {
            logForbidden("order-history", username, auth);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(orderService.findOrdersForUser(username));
    }
}
