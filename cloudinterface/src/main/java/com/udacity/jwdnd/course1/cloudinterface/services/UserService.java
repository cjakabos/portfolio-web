package com.udacity.jwdnd.course1.cloudinterface.services;

import com.udacity.jwdnd.course1.cloudinterface.entity.User;
import com.udacity.jwdnd.course1.cloudinterface.mappers.UserMapper;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;

@Service
public class UserService {
    private UserMapper userMapper;
    private HashService hashService;

    public UserService(UserMapper userMapper, HashService hashService) {
        this.userMapper = userMapper;
        this.hashService = hashService;
    }

    public boolean isUsernameAvailable(String username) {
        return userMapper.getUser(username) == null;
    }

    public int createUser(User user) {
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[16];
        random.nextBytes(salt);

        String saltEncoded = Base64.getEncoder().encodeToString(salt);
        String passwordHash = hashService.getHashedValue(user.getPassword(), saltEncoded);
        return userMapper.insert(
                new User(
                null, user.getUsername(), saltEncoded, passwordHash, user.getFirstname(), user.getLastname()));
    }

    public User getUserById(int id) {
        return userMapper.getUserByUserId(id);
    }

    public User getUserByUsername(String username) {
        return userMapper.getUser(username);
    }

    public Integer getUserId(Authentication authentication) {
        String username = authentication.getName();
        User user = userMapper.getUser(username);
        return user.getUserId();
    }

}
