package com.example.demo.controllers;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.requests.CreateItemRequest;
import com.example.demo.model.service.inf.IItemService;

import static org.junit.jupiter.api.Assertions.*;


import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.*;

public class ItemControllerTest {

    private ItemController itemController;

    private IItemService itemService = mock(IItemService.class);

    private List<Item> items = new ArrayList<>();

    @BeforeEach
    public void setup() {
        itemController = new ItemController(itemService);
        items.clear();
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        items.add(item);
        item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        items.add(item);
    }

    @Test
    public void get_items_happy_path() {
        when(itemService.findAll()).thenReturn(items);
        ResponseEntity<List<Item>> response = itemController.getItems();
        List<Item> savedItems = response.getBody();
        assertNotNull(savedItems);
        assertEquals(items.size(), savedItems.stream().count());
    }

    @Test
    public void get_items_by_id_happy_path() {
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        when(itemService.findById((long) 1)).thenReturn(Optional.of(item));
        ResponseEntity<Item> response = itemController.getItemById(1L);
        Item savedItem = response.getBody();
        assertNotNull(savedItem);
        assertEquals(item.getName(), savedItem.getName());
    }

    @Test
    public void get_items_by_name_happy_path() {
        Item item = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");
        List<Item> items = new ArrayList<>();
        Item item2 = new Item(1L, "device", BigDecimal.valueOf(500), "garden");
        items.add(item);
        items.add(item2);
        when(itemService.findByName(item.getName())).thenReturn(items);
        ResponseEntity<List<Item>> response = itemController.getItemsByName(item.getName());
        List<Item> savedItems = response.getBody();
        assertNotNull(savedItems);
        assertEquals(item.getName(), savedItems.get(0).getName());
    }

    @Test
    public void update_item_happy_path() {
        Item item = new Item(1L, "tool", BigDecimal.valueOf(700), "shed");
        CreateItemRequest request = new CreateItemRequest();
        request.setName("tool");
        request.setPrice(BigDecimal.valueOf(700));
        request.setDescription("shed");

        when(itemService.update(1L, request)).thenReturn(Optional.of(item));

        ResponseEntity<Item> response = itemController.updateItem(1L, request);

        assertNotNull(response.getBody());
        assertEquals(BigDecimal.valueOf(700), response.getBody().getPrice());
    }
}
