package com.udacity.jwdnd.course1.cloudinterface.entity;

import java.math.BigDecimal;
import java.util.*;

public class Cart {
	
	private Long id;
	
    private List<Item> items;
	
    private User user;
	
	private BigDecimal total;

	public Cart() {
	}

	public Cart(Long id, List<Item> items, User user, BigDecimal total) {
		this.id = id;
		this.items = items;
		this.user = user;
		this.total = total;
	}
	
	public BigDecimal getTotal() {
		return total;
	}

	public void setTotal(BigDecimal total) {
		this.total = total;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public List<Item> getItems() {
		return items;
	}

	public void setItems(List<Item> items) {
		this.items = items;
	}
	
	public void addItem(Item item) {
		if(items == null) {
			items = new ArrayList<>();
		}
		items.add(item);
		if(total == null) {
			total = new BigDecimal(0);
		}
		total = total.add(item.getPrice());
	}
	
	public void removeItem(Item item) {
		if(items == null) {
			items = new ArrayList<>();
		}
		items.remove(item);
		if(total == null) {
			total = new BigDecimal(0);
		}
		total = total.subtract(item.getPrice());
	}
}
