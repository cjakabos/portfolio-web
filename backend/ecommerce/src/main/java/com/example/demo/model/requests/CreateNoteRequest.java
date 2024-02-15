package com.example.demo.model.requests;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

public class CreateNoteRequest {

    @JsonProperty
    private String title;
    @JsonProperty
    private String description;
    @JsonProperty
    private String username;


    public String getTitle() {
        return title;
    }

    public void settitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getUser() {
        return username;
    }

    public void setUser(String username) {
        this.username = username;
    }

}
