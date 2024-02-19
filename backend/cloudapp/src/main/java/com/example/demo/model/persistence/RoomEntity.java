package com.example.demo.model.persistence;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "rooms")
@Getter
@Setter
public class RoomEntity {

    @Id
    private String id;
    private String name;
    private String code;
    private String createdBy;
    private Long createdAt;
}
