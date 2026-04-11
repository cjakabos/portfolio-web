package com.example.demo.controllers;

import com.example.demo.commerce.CartResult;
import com.example.demo.commerce.CartService;
import com.example.demo.security.CloudappAccessPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.model.persistence.Cart;
import com.example.demo.model.requests.ModifyCartRequest;

@RestController
@RequestMapping("cart")
public class CartController {
    @Autowired
    private CloudappAccessPolicy cloudappAccessPolicy;

    @Autowired
    private CartService cartService;

    @PostMapping("/addToCart")
    public ResponseEntity<Cart> addToCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, servletRequest, request.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        CartResult result = cartService.addToCart(request.getUsername(), request.getItemId(), request.getQuantity());
        if (result.status() == CartResult.Status.USER_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (result.status() == CartResult.Status.ITEM_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(result.cart());
    }

    @PostMapping("/removeFromCart")
    public ResponseEntity<Cart> removeFromCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, servletRequest, request.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        CartResult result = cartService.removeFromCart(request.getUsername(), request.getItemId(), request.getQuantity());
        if (result.status() == CartResult.Status.USER_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (result.status() == CartResult.Status.ITEM_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(result.cart());
    }

    @PostMapping("/getCart")
    public ResponseEntity<Cart> getCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, servletRequest, request.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        CartResult result = cartService.getCart(request.getUsername());
        if (result.status() == CartResult.Status.USER_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(result.cart());
    }

    @PostMapping("/clearCart")
    public ResponseEntity<Cart> clearCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, servletRequest, request.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        CartResult result = cartService.clearCart(request.getUsername());
        if (result.status() == CartResult.Status.USER_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(result.cart());
    }
}
