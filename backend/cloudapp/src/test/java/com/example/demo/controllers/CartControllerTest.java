package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.commerce.CartResult;
import com.example.demo.commerce.CartService;
import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.User;
import com.example.demo.model.requests.ModifyCartRequest;
import com.example.demo.security.CloudappAccessPolicy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class CartControllerTest {

    private CartController cartController;

    private CloudappAccessPolicy cloudappAccessPolicy = mock(CloudappAccessPolicy.class);
    private CartService cartService = mock(CartService.class);

    private Authentication authFor(String username) {
        return new UsernamePasswordAuthenticationToken(
                new User(1L, username, "hashed"),
                null,
                Collections.emptyList()
        );
    }

    @BeforeEach
    public void setUp() {
        cartController = new CartController();
        TestUtils.injectObjects(cartController, "cloudappAccessPolicy", cloudappAccessPolicy);
        TestUtils.injectObjects(cartController, "cartService", cartService);
        when(cloudappAccessPolicy.canAccessUsername(any(), any(), anyString())).thenReturn(true);
    }

    @Test
    public void add_to_cart_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        List<Item> items = new ArrayList<>();
        items.add(item);
        items.add(item);
        Cart cart = new Cart(1L, items, user, BigDecimal.valueOf(50000));
        user.setCart(cart);

        when(cartService.addToCart(user.getUsername(), 1L, 1)).thenReturn(CartResult.success(cart));

        ModifyCartRequest modifyCartRequest = new ModifyCartRequest(user.getUsername(), 1L, 1);
        ResponseEntity<Cart> cartResponse = cartController.addToCart(
                modifyCartRequest,
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        assertNotNull(cartResponse);
        assertEquals(HttpStatus.OK.value(), cartResponse.getStatusCodeValue());
        assertEquals(2, cartResponse.getBody().getItems().size());
        verify(cartService).addToCart(user.getUsername(), 1L, 1);
    }

    @Test
    public void remove_from_cart_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        List<Item> items = new ArrayList<>();
        items.add(item);
        Cart cart = new Cart(1L, items, user, BigDecimal.valueOf(500));
        user.setCart(cart);

        when(cartService.removeFromCart(user.getUsername(), 1L, 1)).thenReturn(CartResult.success(cart));

        ModifyCartRequest modifyCartRequest = new ModifyCartRequest(user.getUsername(), 1L, 1);
        ResponseEntity<Cart> cartRemovedResponse = cartController.removeFromCart(
                modifyCartRequest,
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        assertNotNull(cartRemovedResponse);
        assertEquals(HttpStatus.OK.value(), cartRemovedResponse.getStatusCodeValue());
        verify(cartService).removeFromCart(user.getUsername(), 1L, 1);
    }
}
