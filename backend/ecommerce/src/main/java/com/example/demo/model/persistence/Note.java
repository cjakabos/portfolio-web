package com.example.demo.model.persistence;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;

@Entity
@Table(name = "notes")
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    @JsonProperty
    private Long id;
    @Column(nullable = false)
    @JsonProperty
    private String title;
    @Column(nullable = false)
    @JsonProperty
    private String description;
    @Column(nullable = false)
    @JsonProperty
    private Long userid;

    public Note() {
    }

    public Note(Long id, String title, String description, Long userid) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.userid = userid;
    }

    public Note(String title, String description, Long userid) {
        this.title = title;
        this.description = description;
        this.userid = userid;
    }

    public Long getId() {
        return id;
    }

    public void setid(Long id) {
        this.id = id;
    }

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

    public Long getUserid() {
        return userid;
    }

    public void setUserid(Long userid) {
        this.userid = userid;
    }
}
