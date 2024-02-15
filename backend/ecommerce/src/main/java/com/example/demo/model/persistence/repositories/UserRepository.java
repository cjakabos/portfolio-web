package com.example.demo.model.persistence.repositories;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.model.persistence.User;

@Transactional
public interface UserRepository extends JpaRepository<User, Long> {
    User findByUsername(String username);
}
