package com.example.demo.model.requests;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class UpdateUserRolesRequest {

    @JsonProperty
    private String username;

    @JsonProperty
    private List<String> roles;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }
}
