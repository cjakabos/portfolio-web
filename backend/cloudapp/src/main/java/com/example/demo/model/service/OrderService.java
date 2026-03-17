package com.example.demo.model.service;

import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.UserOrder;
import com.example.demo.model.persistence.repositories.OrderRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.model.service.inf.IOrderService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OrderService implements IOrderService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public OrderService(UserRepository userRepository, OrderRepository orderRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    public boolean userExists(String username) {
        return userRepository.findByUsername(username) != null;
    }

    @Override
    public Optional<UserOrder> submit(String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return Optional.empty();
        }

        UserOrder order = UserOrder.createFromCart(user.getCart());
        return Optional.of(orderRepository.save(order));
    }

    @Override
    public Optional<List<UserOrder>> findOrdersForUser(String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return Optional.empty();
        }

        return Optional.of(orderRepository.findByUser(user));
    }
}
