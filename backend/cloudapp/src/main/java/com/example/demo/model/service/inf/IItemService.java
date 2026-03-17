package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.requests.CreateItemRequest;

import java.util.List;
import java.util.Optional;

public interface IItemService {

    List<Item> findAll();

    Optional<Item> findById(Long id);

    Optional<Item> create(CreateItemRequest createItemRequest);

    List<Item> findByName(String name);

    Optional<Item> update(Long id, CreateItemRequest updateItemRequest);

    boolean deleteById(Long id);
}
