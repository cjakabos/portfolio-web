package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.model.Message;


public interface IMessageService {

    public void sendMessage(String roomCode, Message msg);
}
