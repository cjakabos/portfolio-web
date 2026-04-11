package com.example.demo.commerce;

import com.example.demo.model.persistence.Cart;

public record CartResult(Status status, Cart cart) {

    public static CartResult success(Cart cart) {
        return new CartResult(Status.SUCCESS, cart);
    }

    public static CartResult failure(Status status) {
        return new CartResult(status, null);
    }

    public enum Status {
        SUCCESS,
        USER_NOT_FOUND,
        ITEM_NOT_FOUND
    }
}
