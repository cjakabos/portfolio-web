package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;

import static org.junit.jupiter.api.Assertions.*;

import com.example.demo.model.persistence.User;
import com.example.demo.model.requests.ModifyCartRequest;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.example.demo.model.persistence.repositories.*;

import java.math.BigDecimal;
import java.util.*;

public class CartControllerTest {

    private CartController cartController;

    private UserRepository userRepository = mock(UserRepository.class);

    private CartRepository cartRepository = mock(CartRepository.class);

    private ItemRepository itemRepository = mock(ItemRepository.class);

    @BeforeEach
    public void setUp() {
        cartController = new CartController();
        TestUtils.injectObjects(cartController, "cartRepository", cartRepository);
        TestUtils.injectObjects(cartController, "itemRepository", itemRepository);
        TestUtils.injectObjects(cartController, "userRepository", userRepository);
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
        ResponseEntity<Cart> cartResponse = cartController.addToCart(modifyCartRequest);
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
        ResponseEntity<Cart> cartResponse = cartController.addToCart(modifyCartRequest);
        ResponseEntity<Cart> cartRemovedResponse = cartController.removeFromCart(modifyCartRequest);
        assertNotNull(cartRemovedResponse);
        assertEquals(HttpStatus.OK.value(), cartRemovedResponse.getStatusCodeValue());
    }
}