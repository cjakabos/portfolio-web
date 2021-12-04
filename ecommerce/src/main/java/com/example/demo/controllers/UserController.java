package com.example.demo.controllers;

import java.util.Optional;

import org.apache.logging.log4j.LogManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.*;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/user")
public class UserController {

    public static final Logger log = LoggerFactory.getLogger(UserController.class);

    @Autowired
    public UserRepository userRepository;

    @Autowired
    public CartRepository cartRepository;

    @Autowired
    public BCryptPasswordEncoder bCryptPasswordEncoder;

    @GetMapping("/id/{id}")
    public ResponseEntity<User> findById(@PathVariable Long id) {
        return ResponseEntity.of(userRepository.findById(id));
    }

    @GetMapping("/{username}")
    public ResponseEntity<User> findByUserName(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        return user == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(user);
    }

    @PostMapping("/create")
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest createUserRequest) {
        User user = new User();

        if (createUserRequest.getPassword().length() < 8) {
            log.error("password is too short");
            return ResponseEntity.badRequest().build();
        }
        if (!createUserRequest.getPassword().equals(createUserRequest.getConfirmPassword())) {
            log.error("password do not match with confirm password");
            return ResponseEntity.badRequest().build();
        }
        user.setUsername(createUserRequest.getUsername());
        user.setPassword(this.bCryptPasswordEncoder.encode(createUserRequest.getPassword()));
        Cart cart = new Cart();
        cartRepository.save(cart);
        user.setCart(cart);
        userRepository.save(user);
        log.info("user creation successful for: " + user.getUsername());
        return ResponseEntity.ok(user);
    }

}
