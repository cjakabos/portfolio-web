package com.udacity.jwdnd.course1.cloudinterface.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

public class CreateUserRequest {

    @JsonProperty
    private String username;
    @JsonProperty
    private String firstname;
    @JsonProperty
    private String lastname;

    @JsonProperty
    private String password;

    @JsonProperty
    private String confirmPassword;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFirstName() {
        return firstname;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public String getLastname() {
        return lastname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }
}
