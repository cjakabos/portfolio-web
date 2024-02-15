package com.example.demo.controllers;

import com.example.demo.model.persistence.UserOrder;
import com.example.demo.TestUtils;
import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.CreateUserRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class OrderControllerTest {

    private OrderController orderController;

    private OrderRepository orderRepository = mock(OrderRepository.class);
    private UserRepository userRepository = mock(UserRepository.class);

    @BeforeEach
    public void setup() {
        orderController = new OrderController();
        TestUtils.injectObjects(orderController, "userRepository", userRepository);
        TestUtils.injectObjects(orderController, "orderRepository", orderRepository);
    }

    @Test
    public void submit_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        Cart cart = new Cart();
        cart.addItem(item);
        user.setCart(cart);

        when(userRepository.findByUsername(user.getUsername())).thenReturn(user);
        ResponseEntity<UserOrder> response = orderController.submit(user.getUsername());
        UserOrder userOrder = response.getBody();

        assertNotNull(response);
        assertEquals(HttpStatus.OK.value(), response.getStatusCodeValue());
        assertEquals(BigDecimal.valueOf(500), userOrder.getTotal());
    }

    @Test
    public void get_orders_for_users_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        List<Item> items = new ArrayList<>();
        items.add(item);
        UserOrder userOrder = new UserOrder(1L, items, user, BigDecimal.valueOf(50000));
        List<UserOrder> userOrderResponse = new ArrayList<>();
        userOrderResponse.add(userOrder);

        when(userRepository.findByUsername(user.getUsername())).thenReturn(user);
        when(orderRepository.findByUser(user)).thenReturn(userOrderResponse);

        ResponseEntity<List<UserOrder>> ordersForUser = orderController.getOrdersForUser(user.getUsername());
        assertNotNull(ordersForUser);
        assertEquals(BigDecimal.valueOf(50000), ordersForUser.getBody().get(0).getTotal());

    }
}