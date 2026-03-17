package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.UserOrder;

import java.util.List;
import java.util.Optional;

public interface IOrderService {

    Optional<UserOrder> submit(String username);

    Optional<List<UserOrder>> findOrdersForUser(String username);
}
