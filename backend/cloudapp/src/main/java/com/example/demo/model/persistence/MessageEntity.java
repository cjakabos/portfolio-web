package com.example.demo.model.persistence;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "messages")
@Getter
@Setter
public class MessageEntity {
    @Id
    private String id;
    private String roomCode;
    private String sender;
    private String content;
    private Long timestamp;
}
