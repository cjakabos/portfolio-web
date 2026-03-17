package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.requests.CreateItemRequest;

import java.util.List;

public interface IItemService {

    List<Item> findAll();

    Item findById(Long id);

    Item create(CreateItemRequest createItemRequest);

    List<Item> findByName(String name);

    Item update(Long id, CreateItemRequest updateItemRequest);

    void deleteById(Long id);
}
