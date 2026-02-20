package com.example.demo.controllers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WebControllerTest {

    private HttpServer server;
    private String serverBaseUrl;
    private WebController controller;

    @BeforeEach
    void setUp() throws Exception {
        try {
            server = HttpServer.create(new InetSocketAddress(0), 0);
            serverBaseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        } catch (IOException bindError) {
            Assumptions.assumeTrue(false, "Socket bind not permitted in this environment");
        }
        controller = new WebController();
        setField("jiraDomain", serverBaseUrl);
        setField("jiraEmail", "tester@example.com");
        setField("jiraApiToken", "test-token");
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void getTicket_returnsJsonObject() throws Exception {
        server.createContext("/rest/api/latest/ticket", exchange -> respond(exchange, 200, "{\"id\":101,\"status\":\"OPEN\"}"));
        server.start();

        String payload = """
                {"jiraPath":"/rest/api/latest/ticket"}
                """;

        ResponseEntity<Object> response = controller.getTicket(payload);
        assertEquals(200, response.getStatusCodeValue());
        assertInstanceOf(Map.class, response.getBody());
        Map<?, ?> data = (Map<?, ?>) response.getBody();
        assertEquals(101, data.get("id"));
        assertEquals("OPEN", data.get("status"));
    }

    @Test
    void getTicket_supportsJsonArray() throws Exception {
        server.createContext("/rest/api/latest/ticket-list", exchange -> respond(exchange, 200, "[{\"id\":1},{\"id\":2}]"));
        server.start();

        String payload = """
                {"jiraPath":"/rest/api/latest/ticket-list"}
                """;

        ResponseEntity<Object> response = controller.getTicket(payload);
        assertEquals(200, response.getStatusCodeValue());
        assertInstanceOf(List.class, response.getBody());
        List<?> data = (List<?>) response.getBody();
        assertEquals(2, data.size());
    }

    @Test
    void createTicket_forwardsBody() throws Exception {
        server.createContext("/rest/api/latest/issue", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            respond(exchange, 200, "{\"received\":" + body + "}");
        });
        server.start();

        String payload = """
                {"jiraPath":"/rest/api/latest/issue","summary":"New task"}
                """;

        String response = controller.createTicket(payload);
        assertTrue(response.contains("summary"));
    }

    @Test
    void updateTicket_returnsRemoteStatusLine() throws Exception {
        server.createContext("/rest/api/latest/issue/123", exchange -> respond(exchange, 204, ""));
        server.start();

        String payload = """
                {"jiraPath":"/rest/api/latest/issue/123","summary":"Updated task"}
                """;

        String response = controller.updateTicket(payload);
        assertTrue(response.contains("204"));
    }

    @Test
    void deleteTicket_returnsRemoteStatusLine() throws Exception {
        server.createContext("/rest/api/latest/issue/123", exchange -> respond(exchange, 200, ""));
        server.start();

        String payload = """
                {"jiraPath":"/rest/api/latest/issue/123"}
                """;

        String response = controller.deleteTicket(payload);
        assertTrue(response.contains("200"));
    }

    @Test
    void getTicket_rejectsTargetsOutsideConfiguredDomain() {
        String payload = """
                {"webDomain":"http://localhost:65500/rest/api/latest/issue/1"}
                """;

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> controller.getTicket(payload)
        );
        assertEquals(403, ex.getStatusCode().value());
    }

    private static void respond(HttpExchange exchange, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void setField(String fieldName, String value) throws Exception {
        Field field = WebController.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(controller, value);
    }
}
