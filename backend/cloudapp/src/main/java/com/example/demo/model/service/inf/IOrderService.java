package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.UserOrder;

import java.util.List;

public interface IOrderService {

    UserOrder submit(String username);

    List<UserOrder> findOrdersForUser(String username);
}
