package com.example.demo.model.requests;

import com.fasterxml.jackson.annotation.JsonProperty;

public class UpdateNoteRequest {

    @JsonProperty
    private String title;
    @JsonProperty
    private String description;
    @JsonProperty
    private Long id;


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

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

}
