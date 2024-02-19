package com.example.demo.model.requests;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class CreateRoomRequest {
    @NotBlank
    private String username;

    @NotBlank
    private String name;

}
