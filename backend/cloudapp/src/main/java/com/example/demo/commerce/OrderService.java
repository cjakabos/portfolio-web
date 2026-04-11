package com.example.demo.commerce;

import com.example.demo.exceptions.RequestValidationException;
import com.example.demo.exceptions.ResourceNotFoundException;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.UserOrder;
import com.example.demo.model.persistence.repositories.OrderRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class OrderService implements IOrderService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrderService.class);

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public OrderService(UserRepository userRepository, OrderRepository orderRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    public boolean userExists(String username) {
        return username != null && !username.isBlank() && userRepository.findByUsername(username) != null;
    }

    @Override
    public UserOrder submit(String username) {
        User user = requireUser(username, "order submit");
        UserOrder order = UserOrder.createFromCart(user.getCart());
        UserOrder savedOrder = orderRepository.save(order);
        LOGGER.info(
                "Created order id={} for username={} total={}",
                savedOrder.getId(),
                username,
                savedOrder.getTotal());
        return savedOrder;
    }

    @Override
    public List<UserOrder> findOrdersForUser(String username) {
        User user = requireUser(username, "order history");
        List<UserOrder> orders = orderRepository.findByUser(user);
        LOGGER.info("Fetched {} orders for username={}", orders.size(), username);
        return orders;
    }

    private User requireUser(String username, String action) {
        if (username == null || username.isBlank()) {
            throw new RequestValidationException("Username must not be blank");
        }
        User user = userRepository.findByUsername(username);
        if (user == null) {
            LOGGER.warn("User not found during {} for username={}", action, username);
            throw new ResourceNotFoundException("User not found: " + username);
        }
        return user;
    }
}
