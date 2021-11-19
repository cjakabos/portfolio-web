package com.udacity.jwdnd.course1.cloudinterface.entity;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

public class UserOrder {

	private Long id;

    private List<Item> items;

    private User user;

	private BigDecimal total;

	public UserOrder() {
	}

	public UserOrder(Long id, List<Item> items, User user, BigDecimal total) {
		this.id = id;
		this.items = items;
		this.user = user;
		this.total = total;
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

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}
	
	public BigDecimal getTotal() {
		return total;
	}

	public void setTotal(BigDecimal total) {
		this.total = total;
	}
	
}
