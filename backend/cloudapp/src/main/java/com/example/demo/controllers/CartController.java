package com.example.demo.controllers;

import com.example.demo.security.InternalRequestAuthorizer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.CartRepository;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.model.requests.ModifyCartRequest;

@RestController
@RequestMapping("cart")
public class CartController {

    @Autowired
    public UserRepository userRepository;

    @Autowired
    public CartRepository cartRepository;

    @Autowired
    public ItemRepository itemRepository;

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

    private boolean isAuthorized(Authentication auth, String usernameFromRequest, HttpServletRequest request) {
        if (internalRequestAuthorizer.isInternalRequest(request)) {
            return true;
        }
        String authenticated = getAuthenticatedUsername(auth);
        return authenticated != null && authenticated.equals(usernameFromRequest);
    }

    @PostMapping("/addToCart")
    public ResponseEntity<Cart> addToCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        User user = userRepository.findByUsername(request.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!isAuthorized(auth, user.getUsername(), servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Optional<Item> item = itemRepository.findById(request.getItemId());
        if (!item.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        Cart cart = user.getCart();
        IntStream.range(0, request.getQuantity())
                .forEach(i -> cart.addItem(item.get()));
        cartRepository.save(cart);
        return ResponseEntity.ok(cart);
    }

    @PostMapping("/removeFromCart")
    public ResponseEntity<Cart> removeFromCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        User user = userRepository.findByUsername(request.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!isAuthorized(auth, user.getUsername(), servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Optional<Item> item = itemRepository.findById(request.getItemId());
        if (!item.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        Cart cart = user.getCart();
        IntStream.range(0, request.getQuantity())
                .forEach(i -> cart.removeItem(item.get()));
        cartRepository.save(cart);
        return ResponseEntity.ok(cart);
    }

    @PostMapping("/getCart")
    public ResponseEntity<Cart> getCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        User user = userRepository.findByUsername(request.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!isAuthorized(auth, user.getUsername(), servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Cart cart = cartRepository.findByUser(user);
        return ResponseEntity.ok(cart);
    }

    @PostMapping("/clearCart")
    public ResponseEntity<Cart> clearCart(
            @RequestBody ModifyCartRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        User user = userRepository.findByUsername(request.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!isAuthorized(auth, user.getUsername(), servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Cart cart = user.getCart();
        cart.removeAllItems();
        cartRepository.save(cart);
        return ResponseEntity.ok(cart);
    }
}
