package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.model.Message;
import java.util.List;


public interface IMessageService {

    public void sendMessage(String roomCode, Message msg);

    public List<String> findRoomsByUser(String string);
}
