package com.example.demo.controllers;

import com.example.demo.model.persistence.model.Message;
import com.example.demo.model.service.inf.IMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class MessageController {

    private final IMessageService service;

    @Autowired
    public MessageController(IMessageService service) {
        this.service = service;
    }

    @MessageMapping("/sendMessage/{roomCode}")
    public void broadcastGroupMessage(
            @DestinationVariable String roomCode,
            @Payload Message message) {
        message.setTimestamp(System.currentTimeMillis());
        service.sendMessage(roomCode, message);
    }

    @MessageMapping("/newUser/{roomCode}")
    @SendTo("/topic/newUser/{roomCode}")
    public Message addUser(@Payload Message message) {
        return message;
    }
}
