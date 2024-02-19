package com.example.demo.model.persistence.model;

import lombok.Getter;
import lombok.Setter;


@Getter
@Setter
public class Message {

    private String sender;
    private String content;
    private long timestamp;

    @Override
    public String toString() {
        return String.format("content[%s] ts[%d]", content, timestamp);
    }

}
