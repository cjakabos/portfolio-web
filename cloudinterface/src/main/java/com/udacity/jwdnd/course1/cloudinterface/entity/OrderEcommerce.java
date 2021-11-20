package com.udacity.jwdnd.course1.cloudinterface.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

public class OrderEcommerce {
    private String ecommerceOrderUsername;

    private long ecommerceItemId;

    private int ecommerceQuantity;

    public OrderEcommerce() {
    }

    public OrderEcommerce(String username, long itemId, int quantity) {
        this.ecommerceOrderUsername = username;
        this.ecommerceItemId = itemId;
        this.ecommerceQuantity = quantity;
    }

    public String getEcommerceOrderUsername() {
        return ecommerceOrderUsername;
    }

    public void setEcommerceOrderUsername(String username) {
        this.ecommerceOrderUsername = username;
    }

    public long getEcommerceItemId() {
        return ecommerceItemId;
    }

    public void setEcommerceItemId(long itemId) {
        this.ecommerceItemId = itemId;
    }

    public int getEcommerceQuantity() {
        return ecommerceQuantity;
    }

    public void setEcommerceQuantity(int quantity) {
        this.ecommerceQuantity = quantity;
    }
}
