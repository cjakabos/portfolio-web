package com.example.demo.model.service;

import com.example.demo.exceptions.RequestValidationException;
import com.example.demo.exceptions.ResourceNotFoundException;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.requests.CreateItemRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

        Item result = itemService.create(request);

        assertEquals("tool", result.getName());
    }

    @Test
    void update_throws_not_found_when_item_is_missing() {
        when(itemRepository.findById(99L)).thenReturn(Optional.empty());
        CreateItemRequest request = new CreateItemRequest();
        request.setName("replacement");

        assertThrows(ResourceNotFoundException.class, () -> itemService.update(99L, request));
    }

    @Test
    void delete_throws_not_found_when_item_is_missing() {
        when(itemRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> itemService.deleteById(99L));
        verify(itemRepository, never()).deleteById(anyLong());
    }

    @Test
    void create_rejects_blank_name() {
        CreateItemRequest request = new CreateItemRequest();
        request.setName("   ");
        request.setPrice(BigDecimal.ONE);

        RequestValidationException ex =
                assertThrows(RequestValidationException.class, () -> itemService.create(request));

        assertEquals("Item name must not be blank", ex.getMessage());
    }
}
