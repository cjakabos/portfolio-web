package com.example.demo.controllers;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("order")
public class OrderController {

    public static final Logger log = LoggerFactory.getLogger(OrderController.class);

    @Autowired
    public UserRepository userRepository;

    @Autowired
    public OrderRepository orderRepository;


    @PostMapping("/submit/{username}")
    public ResponseEntity<UserOrder> submit(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.error("User not found during order submit: " + user.getUsername());
            return ResponseEntity.notFound().build();
        }
        UserOrder order = UserOrder.createFromCart(user.getCart());
        orderRepository.save(order);
        log.info("Userorder creation successful for : " + user.getUsername());
        return ResponseEntity.ok(order);
    }

    @GetMapping("/history/{username}")
    public ResponseEntity<List<UserOrder>> getOrdersForUser(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.error("User not found during order history: " + user.getUsername());
            return ResponseEntity.notFound().build();
        }
        log.info("User order history fetch is successful for : " + user.getUsername());
        return ResponseEntity.ok(orderRepository.findByUser(user));
    }
}
