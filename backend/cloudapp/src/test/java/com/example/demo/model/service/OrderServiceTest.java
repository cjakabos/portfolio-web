package com.example.demo.model.service;

import com.example.demo.exceptions.RequestValidationException;
import com.example.demo.exceptions.ResourceNotFoundException;
import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.UserOrder;
import com.example.demo.model.persistence.repositories.OrderRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderServiceTest {

    private UserRepository userRepository;
    private OrderRepository orderRepository;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        orderRepository = mock(OrderRepository.class);
        orderService = new OrderService(userRepository, orderRepository);
    }

    @Test
    void submit_throws_not_found_when_user_is_missing() {
        when(userRepository.findByUsername("missing")).thenReturn(null);

        assertThrows(ResourceNotFoundException.class, () -> orderService.submit("missing"));
        verify(orderRepository, never()).save(any(UserOrder.class));
    }

    @Test
    void user_exists_reflects_repository_lookup() {
        when(userRepository.findByUsername("testuser")).thenReturn(new User(1L, "testuser", "secret"));
        when(userRepository.findByUsername("missing")).thenReturn(null);

        assertTrue(orderService.userExists("testuser"));
        assertFalse(orderService.userExists("missing"));
        assertFalse(orderService.userExists("  "));
    }

    @Test
    void submit_creates_order_from_user_cart() {
        User user = new User(1L, "testuser", "secret");
        Cart cart = new Cart();
        cart.setUser(user);
        cart.addItem(new Item(1L, "tool", BigDecimal.valueOf(500), "garden"));
        user.setCart(cart);

        when(userRepository.findByUsername("testuser")).thenReturn(user);
        when(orderRepository.save(any(UserOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserOrder result = orderService.submit("testuser");

        assertEquals(BigDecimal.valueOf(500), result.getTotal());
        assertEquals("testuser", result.getUser().getUsername());
    }

    @Test
    void find_orders_for_user_returns_history_when_user_exists() {
        User user = new User(1L, "testuser", "secret");
        List<UserOrder> orders = List.of(new UserOrder());

        when(userRepository.findByUsername("testuser")).thenReturn(user);
        when(orderRepository.findByUser(user)).thenReturn(orders);

        List<UserOrder> result = orderService.findOrdersForUser("testuser");

        assertEquals(1, result.size());
    }

    @Test
    void submit_rejects_blank_username() {
        RequestValidationException ex =
                assertThrows(RequestValidationException.class, () -> orderService.submit("  "));

        assertEquals("Username must not be blank", ex.getMessage());
    }
}
