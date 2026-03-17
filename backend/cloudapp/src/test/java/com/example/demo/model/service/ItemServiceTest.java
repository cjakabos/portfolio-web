package com.example.demo.model.service;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.requests.CreateItemRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemServiceTest {

    private ItemRepository itemRepository;
    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemRepository = mock(ItemRepository.class);
        itemService = new ItemService(itemRepository);
    }

    @Test
    void create_returns_persisted_item() {
        CreateItemRequest request = new CreateItemRequest();
        request.setId(1L);
        request.setName("tool");
        request.setPrice(BigDecimal.valueOf(500));
        request.setDescription("garden");
        Item savedItem = new Item(1L, "tool", BigDecimal.valueOf(500), "garden");

        when(itemRepository.save(any(Item.class))).thenReturn(savedItem);
        when(itemRepository.findById(1L)).thenReturn(Optional.of(savedItem));

        Optional<Item> result = itemService.create(request);

        assertTrue(result.isPresent());
        assertEquals("tool", result.get().getName());
    }

    @Test
    void update_returns_empty_when_item_is_missing() {
        when(itemRepository.findById(99L)).thenReturn(Optional.empty());

        Optional<Item> result = itemService.update(99L, new CreateItemRequest());

        assertTrue(result.isEmpty());
    }

    @Test
    void delete_returns_false_when_item_is_missing() {
        when(itemRepository.existsById(99L)).thenReturn(false);

        boolean deleted = itemService.deleteById(99L);

        assertFalse(deleted);
        verify(itemRepository, never()).deleteById(anyLong());
    }
}
