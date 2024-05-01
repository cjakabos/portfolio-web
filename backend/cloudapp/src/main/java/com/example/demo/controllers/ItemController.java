package com.example.demo.controllers;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.example.demo.model.requests.CreateItemRequest;
import com.example.demo.model.requests.CreateUserRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.repositories.ItemRepository;

@RestController
@RequestMapping("item")
public class ItemController {

    @Autowired
    public ItemRepository itemRepository;

    @GetMapping
    public ResponseEntity<List<Item>> getItems() {
        return ResponseEntity.ok(itemRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Item> getItemById(@PathVariable Long id) {
        return ResponseEntity.of(itemRepository.findById(id));
    }

    @PostMapping
    public ResponseEntity<Item> addItem(@RequestBody CreateItemRequest createItemRequest) {
        Item newItem = new Item(createItemRequest.getId(), createItemRequest.getName(), createItemRequest.getPrice(), createItemRequest.getDescription());
        Item itemResponse = itemRepository.save(newItem);
        return ResponseEntity.of(itemRepository.findById(itemResponse.getId()));
    }

    @GetMapping("/name/{name}")
    public ResponseEntity<List<Item>> getItemsByName(@PathVariable String name) {
        List<Item> items = itemRepository.findByName(name);
        return items == null || items.isEmpty() ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(items);

    }

}
