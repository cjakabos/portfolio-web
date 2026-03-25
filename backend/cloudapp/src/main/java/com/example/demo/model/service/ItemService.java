package com.example.demo.model.service;

import com.example.demo.exceptions.RequestValidationException;
import com.example.demo.exceptions.ResourceNotFoundException;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.requests.CreateItemRequest;
import com.example.demo.model.service.inf.IItemService;
import java.math.BigDecimal;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ItemService implements IItemService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ItemService.class);

    private final ItemRepository itemRepository;

    public ItemService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    @Override
    public List<Item> findAll() {
        return itemRepository.findAll();
    }

    @Override
    public Item findById(Long id) {
        validateItemId(id);
        return findExistingItem(id);
    }

    @Override
    public Item create(CreateItemRequest createItemRequest) {
        validateCreateRequest(createItemRequest);
        Item newItem = new Item(
                createItemRequest.getId(),
                createItemRequest.getName(),
                createItemRequest.getPrice(),
                createItemRequest.getDescription()
        );
        Item savedItem = itemRepository.save(newItem);
        LOGGER.info("Created item id={} name={}", savedItem.getId(), savedItem.getName());
        return savedItem;
    }

    @Override
    public List<Item> findByName(String name) {
        requireNonBlank(name, "Item name must not be blank");
        List<Item> items = itemRepository.findByName(name);
        if (items.isEmpty()) {
            LOGGER.warn("No items found for name={}", name);
            throw new ResourceNotFoundException("Item not found for name: " + name);
        }
        return items;
    }

    @Override
    public Item update(Long id, CreateItemRequest updateItemRequest) {
        validateItemId(id);
        validateUpdateRequest(updateItemRequest);
        Item item = findExistingItem(id);
        if (updateItemRequest.getName() != null) {
            item.setName(updateItemRequest.getName());
        }
        if (updateItemRequest.getPrice() != null) {
            item.setPrice(updateItemRequest.getPrice());
        }
        if (updateItemRequest.getDescription() != null) {
            item.setDescription(updateItemRequest.getDescription());
        }

        Item savedItem = itemRepository.save(item);
        LOGGER.info("Updated item id={} name={}", savedItem.getId(), savedItem.getName());
        return savedItem;
    }

    @Override
    public void deleteById(Long id) {
        validateItemId(id);
        Item existingItem = findExistingItem(id);
        itemRepository.deleteById(id);
        LOGGER.info("Deleted item id={} name={}", existingItem.getId(), existingItem.getName());
    }

    private Item findExistingItem(Long id) {
        return itemRepository.findById(id)
                .orElseThrow(() -> {
                    LOGGER.warn("Item not found for id={}", id);
                    return new ResourceNotFoundException("Item not found with id: " + id);
                });
    }

    private void validateCreateRequest(CreateItemRequest createItemRequest) {
        requireRequest(createItemRequest);
        requireNonBlank(createItemRequest.getName(), "Item name must not be blank");
        requirePrice(createItemRequest.getPrice(), true);
        if (createItemRequest.getId() != null && createItemRequest.getId() <= 0) {
            throw new RequestValidationException("Item id must be positive when provided");
        }
    }

    private void validateUpdateRequest(CreateItemRequest updateItemRequest) {
        requireRequest(updateItemRequest);
        if (updateItemRequest.getName() == null
                && updateItemRequest.getPrice() == null
                && updateItemRequest.getDescription() == null) {
            throw new RequestValidationException("Item update must include at least one field");
        }
        if (updateItemRequest.getName() != null) {
            requireNonBlank(updateItemRequest.getName(), "Item name must not be blank");
        }
        requirePrice(updateItemRequest.getPrice(), false);
    }

    private void requireRequest(CreateItemRequest request) {
        if (request == null) {
            throw new RequestValidationException("Item request body is required");
        }
    }

    private void validateItemId(Long id) {
        if (id == null || id <= 0) {
            throw new RequestValidationException("Item id must be positive");
        }
    }

    private void requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new RequestValidationException(message);
        }
    }

    private void requirePrice(BigDecimal price, boolean required) {
        if (price == null) {
            if (required) {
                throw new RequestValidationException("Item price is required");
            }
            return;
        }
        if (price.signum() < 0) {
            throw new RequestValidationException("Item price must be zero or greater");
        }
    }
}
