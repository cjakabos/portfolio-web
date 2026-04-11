package com.example.demo.controllers;

import com.example.demo.commerce.IOrderService;
import com.example.demo.model.persistence.UserOrder;
import com.example.demo.model.persistence.*;
import com.example.demo.security.CloudappAccessPolicy;

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
import java.util.Optional;

public class OrderControllerTest {

    private OrderController orderController;

    private IOrderService orderService = mock(IOrderService.class);
    private CloudappAccessPolicy cloudappAccessPolicy = mock(CloudappAccessPolicy.class);

    private Authentication authFor(String username) {
        return new UsernamePasswordAuthenticationToken(
                new User(1L, username, "hashed"),
                null,
                Collections.emptyList()
        );
    }

    @BeforeEach
    public void setup() {
        orderController = new OrderController(orderService, cloudappAccessPolicy);
        when(orderService.userExists(any())).thenReturn(true);
        when(cloudappAccessPolicy.canAccessUsername(any(), any(), any())).thenReturn(true);
        when(cloudappAccessPolicy.resolveAuthenticatedUsername(any(Authentication.class), any())).thenReturn(Optional.empty());
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

    @Test
    public void submit_returns_not_found_before_authorization_when_user_missing() {
        when(orderService.userExists("ghostuser")).thenReturn(false);

        ResponseEntity<UserOrder> response = orderController.submit(
                "ghostuser",
                authFor("otheruser"),
                new MockHttpServletRequest()
        );

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(orderService, never()).submit(any());
    }

    @Test
    public void submit_returns_forbidden_for_other_authenticated_user_when_target_exists() {
        when(cloudappAccessPolicy.canAccessUsername(any(), any(), eq("testuser"))).thenReturn(false);
        when(cloudappAccessPolicy.resolveAuthenticatedUsername(any(Authentication.class), any())).thenReturn(java.util.Optional.of("otheruser"));

        ResponseEntity<UserOrder> response = orderController.submit(
                "testuser",
                authFor("otheruser"),
                new MockHttpServletRequest()
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(orderService, never()).submit(any());
    }

    @Test
    public void get_orders_returns_not_found_before_authorization_when_user_missing() {
        when(orderService.userExists("ghostuser")).thenReturn(false);

        ResponseEntity<List<UserOrder>> response = orderController.getOrdersForUser(
                "ghostuser",
                authFor("otheruser"),
                new MockHttpServletRequest()
        );

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(orderService, never()).findOrdersForUser(any());
    }
}
