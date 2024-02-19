package com.example.demo.websocket;

import com.example.demo.model.persistence.MessageEntity;
import com.example.demo.model.persistence.repositories.MessageRepository;
import com.example.demo.model.persistence.model.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.GenericMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.List;

@Component
public class WebSocketEventListener {

    @Autowired
    private MessageRepository repo;

    @Autowired
    private SimpMessagingTemplate template;

    private MessageHeaders createHeaders(String sessionId) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor
                .create(SimpMessageType.MESSAGE);
        headerAccessor.setSessionId(sessionId);
        headerAccessor.setLeaveMutable(true);
        return headerAccessor.getMessageHeaders();
    }

    @EventListener
    public void handleSessionSubscribeEvent(SessionSubscribeEvent event) {
        GenericMessage message = (GenericMessage) event.getMessage();
        String simpDestination = (String) message.getHeaders().get("simpDestination");
        String sessionId = (String) message.getHeaders().get("simpSessionId");
        if (simpDestination == null
                || !simpDestination.contains("/topic/group/")) {
            return;
        }
        String[] parts = simpDestination.split("/");
        String roomCode = parts[parts.length - 1];
        List<MessageEntity> data = repo.findByRoomCode(roomCode);
        for (MessageEntity entity : data) {
            Message msg = new Message();
            msg.setContent(entity.getContent());
            msg.setSender(entity.getSender());
            msg.setTimestamp(entity.getTimestamp());
            template.convertAndSendToUser(
                    sessionId, "/queue/load-history",
                    msg, createHeaders(sessionId));
        }
    }
}
