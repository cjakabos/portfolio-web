package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.CreateUserRequest;

import static org.junit.jupiter.api.Assertions.*;


import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

public class UserControllerTest {

    private UserController userController;

    private UserRepository userRepository = mock(UserRepository.class);

    private CartRepository cartRepository = mock(CartRepository.class);

    private PasswordEncoder encoder = mock(PasswordEncoder.class);

    private CreateUserRequest r = new CreateUserRequest();


    @BeforeEach
    public void setUp() {
        userController = new UserController();
        TestUtils.injectObjects(userController, "userRepository", userRepository);
        TestUtils.injectObjects(userController, "cartRepository", cartRepository);
        TestUtils.injectObjects(userController, "passwordEncoder", encoder);


        when(encoder.encode("testpassword")).thenReturn("thisIsHashed");


        r.setUsername("testuser");
        r.setPassword("testpassword");
        r.setConfirmPassword("testpassword");
        userController.createUser(r);
    }

    @Test
    public void create_user_happy_path() throws Exception {

        final ResponseEntity<User> response = userController.createUser(r);

        assertNotNull(response);
        assertEquals(HttpStatus.OK.value(), response.getStatusCodeValue());
        User u = response.getBody();
        assertNotNull(u);
        //assertEquals(0, u.getId());
        assertEquals("testuser", u.getUsername());
        assertEquals("thisIsHashed", u.getPassword());
    }


    @Test
    public void find_by_id_happy_path() {
        //given
        ResponseEntity<User> response = userController.createUser(r);
        User user = response.getBody();
        user.setId(1L);

        //when
        when(userRepository.findById((long) 1)).thenReturn(Optional.of(user));
        response = userController.findById(1L);

        //then
        assertNotNull(response);
        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertEquals("testuser", response.getBody().getUsername());
    }

    @Test
    public void find_by_user_name_happy_path() {
        //given
        ResponseEntity<User> response = userController.createUser(r);
        User user = response.getBody();

        //when
        when(userRepository.findByUsername("test")).thenReturn(user);
        response = userController.findByUserName("test");

        //then
        assertNotNull(response);
        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertEquals("testuser", response.getBody().getUsername());
    }
}