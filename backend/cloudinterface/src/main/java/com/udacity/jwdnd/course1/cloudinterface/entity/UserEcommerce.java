package com.udacity.jwdnd.course1.cloudinterface.entity;

public class UserEcommerce {

    private long id;

    private String ecommerceUsername;

    private String ecommercePassword;

    public UserEcommerce() {
    }

    public UserEcommerce(long id, String username, String password) {
        this.id = id;
        this.ecommerceUsername = username;
        this.ecommercePassword = password;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getEcommerceUsername() {
        return ecommerceUsername;
    }

    public void setEcommerceUsername(String ecommerceUsername) {
        this.ecommerceUsername = ecommerceUsername;
    }

    public String getEcommercePassword() {
        return ecommercePassword;
    }

    public void setEcommercePassword(String ecommerceUsername) {
        this.ecommercePassword = ecommerceUsername;
    }

}
