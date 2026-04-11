package com.example.demo.commerce;

import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.CartRepository;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.stream.IntStream;

@Service
public class CartService {

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final ItemRepository itemRepository;

    public CartService(
            UserRepository userRepository,
            CartRepository cartRepository,
            ItemRepository itemRepository
    ) {
        this.userRepository = userRepository;
        this.cartRepository = cartRepository;
        this.itemRepository = itemRepository;
    }

    public CartResult addToCart(String username, Long itemId, int quantity) {
        Optional<User> user = findUser(username);
        if (user.isEmpty()) {
            return CartResult.failure(CartResult.Status.USER_NOT_FOUND);
        }

        Optional<Item> item = itemRepository.findById(itemId);
        if (item.isEmpty()) {
            return CartResult.failure(CartResult.Status.ITEM_NOT_FOUND);
        }

        Cart cart = user.get().getCart();
        IntStream.range(0, quantity).forEach(i -> cart.addItem(item.get()));
        return CartResult.success(cartRepository.save(cart));
    }

    public CartResult removeFromCart(String username, Long itemId, int quantity) {
        Optional<User> user = findUser(username);
        if (user.isEmpty()) {
            return CartResult.failure(CartResult.Status.USER_NOT_FOUND);
        }

        Optional<Item> item = itemRepository.findById(itemId);
        if (item.isEmpty()) {
            return CartResult.failure(CartResult.Status.ITEM_NOT_FOUND);
        }

        Cart cart = user.get().getCart();
        IntStream.range(0, quantity).forEach(i -> cart.removeItem(item.get()));
        return CartResult.success(cartRepository.save(cart));
    }

    public CartResult getCart(String username) {
        return findUser(username)
                .map(user -> CartResult.success(cartRepository.findByUser(user)))
                .orElseGet(() -> CartResult.failure(CartResult.Status.USER_NOT_FOUND));
    }

    public CartResult clearCart(String username) {
        return findUser(username)
                .map(user -> {
                    Cart cart = user.getCart();
                    cart.removeAllItems();
                    return CartResult.success(cartRepository.save(cart));
                })
                .orElseGet(() -> CartResult.failure(CartResult.Status.USER_NOT_FOUND));
    }

    private Optional<User> findUser(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(userRepository.findByUsername(username));
    }
}
