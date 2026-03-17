package com.example.demo.model.service;

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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

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
    void submit_returns_empty_when_user_is_missing() {
        when(userRepository.findByUsername("missing")).thenReturn(null);

        Optional<UserOrder> result = orderService.submit("missing");

        assertTrue(result.isEmpty());
        verify(orderRepository, never()).save(any(UserOrder.class));
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

        Optional<UserOrder> result = orderService.submit("testuser");

        assertTrue(result.isPresent());
        assertEquals(BigDecimal.valueOf(500), result.get().getTotal());
        assertEquals("testuser", result.get().getUser().getUsername());
    }

    @Test
    void find_orders_for_user_returns_history_when_user_exists() {
        User user = new User(1L, "testuser", "secret");
        List<UserOrder> orders = List.of(new UserOrder());

        when(userRepository.findByUsername("testuser")).thenReturn(user);
        when(orderRepository.findByUser(user)).thenReturn(orders);

        Optional<List<UserOrder>> result = orderService.findOrdersForUser("testuser");

        assertTrue(result.isPresent());
        assertEquals(1, result.get().size());
    }
}
