package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;

import static org.junit.jupiter.api.Assertions.*;

import com.example.demo.model.persistence.User;
import com.example.demo.model.requests.ModifyCartRequest;
import com.example.demo.security.InternalRequestAuthorizer;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import com.example.demo.model.persistence.repositories.*;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.*;

public class CartControllerTest {

    private CartController cartController;

    private UserRepository userRepository = mock(UserRepository.class);

    private CartRepository cartRepository = mock(CartRepository.class);

    private ItemRepository itemRepository = mock(ItemRepository.class);
    private InternalRequestAuthorizer internalRequestAuthorizer = mock(InternalRequestAuthorizer.class);

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
        TestUtils.injectObjects(cartController, "cartRepository", cartRepository);
        TestUtils.injectObjects(cartController, "itemRepository", itemRepository);
        TestUtils.injectObjects(cartController, "userRepository", userRepository);
        TestUtils.injectObjects(cartController, "internalRequestAuthorizer", internalRequestAuthorizer);
        when(internalRequestAuthorizer.isInternalRequest(any())).thenReturn(false);
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

        when(userRepository.findByUsername(user.getUsername())).thenReturn(user);
        when(itemRepository.findById((long) 1)).thenReturn(Optional.of(item));

        ModifyCartRequest modifyCartRequest = new ModifyCartRequest(user.getUsername(), 1L, 1);
        ResponseEntity<Cart> cartResponse = cartController.addToCart(
                modifyCartRequest,
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        assertNotNull(cartResponse);
        assertEquals(HttpStatus.OK.value(), cartResponse.getStatusCodeValue());
        assertEquals(3, cartResponse.getBody().getItems().size());
    }

    @Test
    public void remove_from_cart_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        List<Item> items = new ArrayList<>();
        items.add(item);
        items.add(item);
        Cart cart = new Cart(1L, items, user, BigDecimal.valueOf(50000));
        user.setCart(cart);

        when(userRepository.findByUsername(user.getUsername())).thenReturn(user);
        when(itemRepository.findById((long) 1)).thenReturn(Optional.of(item));

        ModifyCartRequest modifyCartRequest = new ModifyCartRequest(user.getUsername(), 1L, 1);
        ResponseEntity<Cart> cartResponse = cartController.addToCart(
                modifyCartRequest,
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        ResponseEntity<Cart> cartRemovedResponse = cartController.removeFromCart(
                modifyCartRequest,
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        assertNotNull(cartRemovedResponse);
        assertEquals(HttpStatus.OK.value(), cartRemovedResponse.getStatusCodeValue());
    }
}
