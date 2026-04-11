package com.example.demo.controllers;

import com.example.demo.security.CloudappAccessPolicy;
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

    private final CloudappAccessPolicy cloudappAccessPolicy;

    public OrderController(IOrderService orderService, CloudappAccessPolicy cloudappAccessPolicy) {
        this.orderService = orderService;
        this.cloudappAccessPolicy = cloudappAccessPolicy;
    }

    private void logForbidden(String action, String username, Authentication auth, HttpServletRequest request) {
        log.warn(
                "Rejected {} request for username={} from authenticatedUser={}",
                action,
                username,
                cloudappAccessPolicy.resolveAuthenticatedUsername(auth, request).orElse("anonymous"));
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
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, username)) {
            logForbidden("order-submit", username, auth, request);
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
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, username)) {
            logForbidden("order-history", username, auth, request);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(orderService.findOrdersForUser(username));
    }
}
