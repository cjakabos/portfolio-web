package com.example.demo.model.service;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.requests.CreateItemRequest;
import com.example.demo.model.service.inf.IItemService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ItemService implements IItemService {

    private final ItemRepository itemRepository;

    public ItemService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    @Override
    public List<Item> findAll() {
        return itemRepository.findAll();
    }

    @Override
    public Optional<Item> findById(Long id) {
        return itemRepository.findById(id);
    }

    @Override
    public Optional<Item> create(CreateItemRequest createItemRequest) {
        Item newItem = new Item(
                createItemRequest.getId(),
                createItemRequest.getName(),
                createItemRequest.getPrice(),
                createItemRequest.getDescription()
        );
        Item savedItem = itemRepository.save(newItem);
        return itemRepository.findById(savedItem.getId());
    }

    @Override
    public List<Item> findByName(String name) {
        return itemRepository.findByName(name);
    }

    @Override
    public Optional<Item> update(Long id, CreateItemRequest updateItemRequest) {
        Optional<Item> existingItem = itemRepository.findById(id);
        if (existingItem.isEmpty()) {
            return Optional.empty();
        }

        Item item = existingItem.get();
        if (updateItemRequest.getName() != null) {
            item.setName(updateItemRequest.getName());
        }
        if (updateItemRequest.getPrice() != null) {
            item.setPrice(updateItemRequest.getPrice());
        }
        if (updateItemRequest.getDescription() != null) {
            item.setDescription(updateItemRequest.getDescription());
        }

        return Optional.of(itemRepository.save(item));
    }

    @Override
    public boolean deleteById(Long id) {
        if (!itemRepository.existsById(id)) {
            return false;
        }

        itemRepository.deleteById(id);
        return true;
    }
}
