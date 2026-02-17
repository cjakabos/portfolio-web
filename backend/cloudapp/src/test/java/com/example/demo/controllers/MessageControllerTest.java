package com.example.demo.controllers;

import com.example.demo.model.persistence.model.Message;
import com.example.demo.model.service.inf.IMessageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class MessageControllerTest {

    @Test
    void broadcastGroupMessage_setsTimestampAndDelegates() {
        IMessageService service = mock(IMessageService.class);
        MessageController controller = new MessageController(service);
        Message payload = new Message();
        payload.setSender("alice");
        payload.setContent("hello");

        controller.broadcastGroupMessage("ROOM1", payload);

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(service, times(1)).sendMessage(eq("ROOM1"), captor.capture());
        Message sent = captor.getValue();
        assertEquals("alice", sent.getSender());
        assertEquals("hello", sent.getContent());
        assertTrue(sent.getTimestamp() > 0);
    }

    @Test
    void addUser_echoesPayload() {
        IMessageService service = mock(IMessageService.class);
        MessageController controller = new MessageController(service);
        Message payload = new Message();
        payload.setSender("bob");
        payload.setContent("newUser");

        Message resp = controller.addUser(payload);
        assertEquals("bob", resp.getSender());
        assertEquals("newUser", resp.getContent());
    }
}
