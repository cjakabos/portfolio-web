package com.example.demo.controllers;

import com.example.demo.model.persistence.UserOrder;
import com.example.demo.model.persistence.*;
import com.example.demo.model.service.inf.IOrderService;
import com.example.demo.security.InternalRequestAuthorizer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class OrderControllerTest {

    private OrderController orderController;

    private IOrderService orderService = mock(IOrderService.class);
    private InternalRequestAuthorizer internalRequestAuthorizer = mock(InternalRequestAuthorizer.class);

    private Authentication authFor(String username) {
        return new UsernamePasswordAuthenticationToken(
                new User(1L, username, "hashed"),
                null,
                Collections.emptyList()
        );
    }

    @BeforeEach
    public void setup() {
        orderController = new OrderController(orderService, internalRequestAuthorizer);
        when(internalRequestAuthorizer.isInternalRequest(any())).thenReturn(false);
    }

    @Test
    public void submit_happy_path() {
        User user = new User(1L, "testuser", "testpassword");
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        Cart cart = new Cart();
        cart.addItem(item);
        user.setCart(cart);
        UserOrder userOrder = UserOrder.createFromCart(cart);

        when(orderService.submit(user.getUsername())).thenReturn(userOrder);
        ResponseEntity<UserOrder> response = orderController.submit(
                user.getUsername(),
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        UserOrder savedOrder = response.getBody();

        assertNotNull(response);
        assertEquals(HttpStatus.OK.value(), response.getStatusCodeValue());
        assertEquals(BigDecimal.valueOf(500), savedOrder.getTotal());
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

        when(orderService.findOrdersForUser(user.getUsername())).thenReturn(userOrderResponse);

        ResponseEntity<List<UserOrder>> ordersForUser = orderController.getOrdersForUser(
                user.getUsername(),
                authFor(user.getUsername()),
                new MockHttpServletRequest()
        );
        assertNotNull(ordersForUser);
        assertEquals(BigDecimal.valueOf(50000), ordersForUser.getBody().get(0).getTotal());

    }
}
