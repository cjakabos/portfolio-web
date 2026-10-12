package com.example.demo;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.*;
import com.example.demo.utilities.JwtUtilities;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;
import java.lang.reflect.Type;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the CloudApp service.
 *
 * These tests exercise the FULL request lifecycle:
 *   Controller → Service → Repository → Real Database (Postgres + MongoDB)
 *
 * Prerequisites:
 *   - Postgres running on test-postgres:5432 (or localhost:15433)
 *   - MongoDB running on test-mongo:27017 (or localhost:17018)
 *   - Kafka running on test-kafka:29092 (or localhost:29092)
 *
 * Run via docker-compose.test.yml:
 *   docker compose -f docker-compose.test.yml up --build test-backend --abort-on-container-exit
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "kafka.group.id=integration-live-chat")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class CloudAppIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private javax.sql.DataSource dataSource;

    @LocalServerPort
    private int serverPort;

    @Autowired
    private JwtUtilities jwtUtilities;

    private String jwtToken;
    private String jwtCookieToken;
    private String jwtTokenOtherUser;
    private String jwtTokenOtherUserPromotedAdmin;
    private String adminJwtToken;
    private static final String TEST_USERNAME = "integrationuser";
    private static final String TEST_PASSWORD = "securePass123";
    private static final String OTHER_USERNAME = "integrationuser2";
    private static final String ADMIN_USERNAME = "integrationadmin";

    // =========================================================================
    // USER REGISTRATION & AUTHENTICATION
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("POST /user/user-register — should create user and return 200")
    void registerUser_happyPath() throws Exception {
        CreateUserRequest request = new CreateUserRequest();
        request.setUsername(TEST_USERNAME);
        request.setPassword(TEST_PASSWORD);
        request.setConfirmPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(TEST_USERNAME))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn();

        // Verify user was actually persisted in Postgres
        User dbUser = userRepository.findByUsername(TEST_USERNAME);
        assertNotNull(dbUser, "User should exist in database after registration");
        assertNotNull(dbUser.getCart(), "User should have a cart created automatically");
        assertEquals(java.util.Set.of("ROLE_USER"), dbUser.getRoles());
        assertEquals(dbUser.getId(), dbUser.getCart().getUser().getId());
    }

    @Test
    @Order(2)
    @DisplayName("POST /user/user-register — short password returns 400")
    void registerUser_shortPassword() throws Exception {
        CreateUserRequest request = new CreateUserRequest();
        request.setUsername("shortpwduser");
        request.setPassword("abc");
        request.setConfirmPassword("abc");

        mockMvc.perform(post("/user/user-register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        assertNull(userRepository.findByUsername("shortpwduser"));
    }

    @Test
    @Order(3)
    @DisplayName("POST /user/user-register — mismatched passwords returns 400")
    void registerUser_passwordMismatch() throws Exception {
        CreateUserRequest request = new CreateUserRequest();
        request.setUsername("mismatchuser");
        request.setPassword("validPass123");
        request.setConfirmPassword("differentPass456");

        mockMvc.perform(post("/user/user-register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        assertNull(userRepository.findByUsername("mismatchuser"));
    }

    @Test
    @Order(4)
    @DisplayName("POST /user/user-login — valid credentials return auth cookie")
    void login_happyPath() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(TEST_USERNAME);
        loginRequest.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        jwtToken = extractAuthCookieToken(result);
        assertNotNull(jwtToken, "JWT token should be returned in CLOUDAPP_AUTH cookie");
        assertFalse(jwtToken.isEmpty(), "JWT token should not be empty");

        String authCookieHeader = findAuthCookieHeader(result);
        assertNotNull(authCookieHeader, "JWT auth cookie should be returned in Set-Cookie header");
        assertTrue(authCookieHeader.contains("CLOUDAPP_AUTH="), "Set-Cookie should include CLOUDAPP_AUTH");
        assertTrue(authCookieHeader.contains("HttpOnly"), "Auth cookie should be HttpOnly");
        jwtCookieToken = jwtToken;
        assertFalse(jwtCookieToken.isEmpty(), "JWT cookie token should not be empty");
    }

    @Test
    @Order(5)
    @DisplayName("POST /user/user-login — invalid credentials return 401")
    void login_invalidCredentials() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(TEST_USERNAME);
        loginRequest.setPassword("wrongPassword");

        mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // USER LOOKUP
    // =========================================================================

    @Test
    @Order(6)
    @DisplayName("GET /user/{username} — should return user details with JWT")
    void findByUsername_happyPath() throws Exception {
        mockMvc.perform(get("/user/" + TEST_USERNAME)
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(TEST_USERNAME))
                .andExpect(jsonPath("$.password").doesNotExist());

        mockMvc.perform(get("/user/" + TEST_USERNAME)
                        .cookie(new Cookie("CLOUDAPP_AUTH", jwtCookieToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(TEST_USERNAME))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    @Order(7)
    @DisplayName("GET /user/{username} — nonexistent user returns 404")
    void findByUsername_notFound() throws Exception {
        mockMvc.perform(get("/user/nonexistentuser")
                        .header("Authorization", jwtToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(8)
    @DisplayName("POST /user/user-register + /user/user-login — create second user for authz tests")
    void createAndLoginSecondUser() throws Exception {
        CreateUserRequest register = new CreateUserRequest();
        register.setUsername(OTHER_USERNAME);
        register.setPassword(TEST_PASSWORD);
        register.setConfirmPassword(TEST_PASSWORD);

        mockMvc.perform(post("/user/user-register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isOk());

        LoginRequest login = new LoginRequest();
        login.setUsername(OTHER_USERNAME);
        login.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        jwtTokenOtherUser = extractAuthCookieToken(result);
        assertNotNull(jwtTokenOtherUser);
    }

    @Test
    @Order(9)
    @DisplayName("GET /user/{username} — other authenticated user gets 403")
    void findByUsername_forbiddenForOtherUser() throws Exception {
        mockMvc.perform(get("/user/" + TEST_USERNAME)
                        .header("Authorization", jwtTokenOtherUser))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // ITEM CRUD
    // =========================================================================

    @Test
    @Order(10)
    @DisplayName("POST /item — non-admin forbidden, admin can create item in Postgres")
    void createItem() throws Exception {
        CreateItemRequest request = new CreateItemRequest();
        request.setName("Widget A");
        request.setPrice(new BigDecimal("19.99"));
        request.setDescription("A high-quality widget");

        mockMvc.perform(post("/item")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());

        String adminToken = ensureAdminJwtToken();

        mockMvc.perform(post("/item")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Widget A"))
                .andExpect(jsonPath("$.price").value(19.99))
                .andExpect(jsonPath("$.description").value("A high-quality widget"));

        // Verify in DB
        List<Item> items = itemRepository.findByName("Widget A");
        assertFalse(items.isEmpty(), "Item should exist in database");
    }

    @Test
    @Order(67)
    @DisplayName("POST /item — invalid admin payload returns 400 ProblemDetail")
    void createItem_invalidPayload() throws Exception {
        CreateItemRequest request = new CreateItemRequest();
        request.setName(" ");
        request.setPrice(new BigDecimal("-1.00"));

        mockMvc.perform(post("/item")
                        .header("Authorization", ensureAdminJwtToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value("Item name must not be blank"));
    }

    @Test
    @Order(11)
    @DisplayName("GET /item — should return all items")
    void getItems() throws Exception {
        ensureWidgetAExists();
        mockMvc.perform(get("/item")
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(12)
    @DisplayName("GET /item/{id} — should return item by ID")
    void getItemById() throws Exception {
        ensureWidgetAExists();
        List<Item> items = itemRepository.findByName("Widget A");
        Long itemId = items.get(0).getId();

        mockMvc.perform(get("/item/" + itemId)
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(itemId))
                .andExpect(jsonPath("$.name").value("Widget A"));
    }

    @Test
    @Order(13)
    @DisplayName("GET /item/name/{name} — should find items by name")
    void getItemsByName() throws Exception {
        ensureWidgetAExists();
        mockMvc.perform(get("/item/name/Widget A")
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Widget A"));
    }

    @Test
    @Order(14)
    @DisplayName("GET /item/name/{name} — nonexistent name returns 404")
    void getItemsByName_notFound() throws Exception {
        mockMvc.perform(get("/item/name/NonexistentItem")
                        .header("Authorization", jwtToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(15)
    @DisplayName("JWT tokens include roles claim and admin login gets ROLE_ADMIN")
    void jwtRolesClaimAndAdminLogin() throws Exception {
        adminJwtToken = ensureAdminJwtToken();
        assertNotNull(adminJwtToken);

        List<String> userRoles = jwtUtilities.getRoles(jwtToken);
        assertTrue(userRoles.contains("ROLE_USER"), "Regular user token should include ROLE_USER");
        assertFalse(userRoles.contains("ROLE_ADMIN"), "Regular user token should not include ROLE_ADMIN");

        List<String> adminRoles = jwtUtilities.getRoles(adminJwtToken);
        assertTrue(adminRoles.contains("ROLE_USER"), "Admin user token should include ROLE_USER");
        assertTrue(adminRoles.contains("ROLE_ADMIN"), "Admin user token should include ROLE_ADMIN");
    }

    @Test
    @Order(16)
    @DisplayName("GET /user/admin/users — non-admin JWT returns 403")
    void adminUsers_nonAdminForbidden() throws Exception {
        mockMvc.perform(get("/user/admin/users")
                        .header("Authorization", jwtToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(17)
    @DisplayName("GET /user/admin/users — admin JWT returns usernames")
    void adminUsers_adminAllowed() throws Exception {
        mockMvc.perform(get("/user/admin/users")
                        .header("Authorization", adminJwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItems(TEST_USERNAME, OTHER_USERNAME, ADMIN_USERNAME)));
    }

    @Test
    @Order(18)
    @DisplayName("POST /user/admin/roles — non-admin JWT returns 403")
    void adminRoles_nonAdminForbidden() throws Exception {
        Map<String, Object> request = Map.of(
                "username", OTHER_USERNAME,
                "roles", List.of("ADMIN")
        );

        mockMvc.perform(post("/user/admin/roles")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(19)
    @DisplayName("POST /user/admin/roles — admin can promote user and new JWT includes ROLE_ADMIN")
    void adminRoles_adminPromotesUserAndPersistsRole() throws Exception {
        Map<String, Object> request = Map.of(
                "username", OTHER_USERNAME,
                "roles", List.of("ADMIN")
        );

        mockMvc.perform(post("/user/admin/roles")
                        .header("Authorization", adminJwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(OTHER_USERNAME))
                .andExpect(jsonPath("$.roles", hasItems("ROLE_USER", "ROLE_ADMIN")));

        User promotedUser = userRepository.findByUsername(OTHER_USERNAME);
        assertNotNull(promotedUser);
        assertTrue(promotedUser.getRoles().contains("ROLE_ADMIN"), "Promoted user roles should be persisted");

        LoginRequest login = new LoginRequest();
        login.setUsername(OTHER_USERNAME);
        login.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        jwtTokenOtherUserPromotedAdmin = extractAuthCookieToken(result);
        assertNotNull(jwtTokenOtherUserPromotedAdmin);

        List<String> promotedRoles = jwtUtilities.getRoles(jwtTokenOtherUserPromotedAdmin);
        assertTrue(promotedRoles.contains("ROLE_ADMIN"), "Promoted user JWT should include ROLE_ADMIN");

        mockMvc.perform(get("/user/admin/users")
                        .header("Authorization", jwtTokenOtherUserPromotedAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItems(TEST_USERNAME, OTHER_USERNAME, ADMIN_USERNAME)));
    }

    // =========================================================================
    // CART OPERATIONS
    // =========================================================================

    @Test
    @Order(20)
    @DisplayName("POST /cart/addToCart — should add items to user cart")
    void addToCart() throws Exception {
        List<Item> items = itemRepository.findByName("Widget A");
        Long itemId = items.get(0).getId();

        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);
        request.setItemId(itemId);
        request.setQuantity(3);

        mockMvc.perform(post("/cart/addToCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.total").isNotEmpty());
    }

    @Test
    @Order(21)
    @DisplayName("POST /cart/addToCart — cross-user cart access returns 403")
    void addToCart_otherUserForbidden() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername("ghostuser");
        request.setItemId(1L);
        request.setQuantity(1);

        mockMvc.perform(post("/cart/addToCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(22)
    @DisplayName("POST /cart/addToCart — nonexistent item returns 404")
    void addToCart_noItem() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);
        request.setItemId(99999L);
        request.setQuantity(1);

        mockMvc.perform(post("/cart/addToCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(23)
    @DisplayName("POST /cart/removeFromCart — should remove items from cart")
    void removeFromCart() throws Exception {
        List<Item> items = itemRepository.findByName("Widget A");
        Long itemId = items.get(0).getId();

        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);
        request.setItemId(itemId);
        request.setQuantity(1);

        mockMvc.perform(post("/cart/removeFromCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    @Order(24)
    @DisplayName("POST /cart/getCart — should return current cart state")
    void getCart() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);

        mockMvc.perform(post("/cart/getCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    @Order(25)
    @DisplayName("POST /cart/getCart — other authenticated user gets 403")
    void getCart_forbiddenForOtherUser() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);

        mockMvc.perform(post("/cart/getCart")
                        .header("Authorization", jwtTokenOtherUser)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // ORDER SUBMISSION
    // =========================================================================

    @Test
    @Order(30)
    @DisplayName("POST /order/submit/{username} — should create order from cart")
    void submitOrder() throws Exception {
        mockMvc.perform(post("/order/submit/" + TEST_USERNAME)
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.total").isNotEmpty())
                .andExpect(jsonPath("$.user.username").value(TEST_USERNAME));

        // Verify order was persisted
        User user = userRepository.findByUsername(TEST_USERNAME);
        List<UserOrder> orders = orderRepository.findByUser(user);
        assertFalse(orders.isEmpty(), "Order should be saved in database");
    }

    @Test
    @Order(31)
    @DisplayName("GET /order/history/{username} — should return order history")
    void getOrderHistory() throws Exception {
        mockMvc.perform(get("/order/history/" + TEST_USERNAME)
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(32)
    @DisplayName("POST /order/submit/{username} — nonexistent user returns 404")
    void submitOrder_noUser() throws Exception {
        mockMvc.perform(post("/order/submit/ghostuser")
                        .header("Authorization", jwtToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(33)
    @DisplayName("GET /order/history/{username} — other authenticated user gets 403")
    void getOrderHistory_forbiddenForOtherUser() throws Exception {
        mockMvc.perform(get("/order/history/" + TEST_USERNAME)
                        .header("Authorization", jwtTokenOtherUser))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // CART CLEAR
    // =========================================================================

    @Test
    @Order(40)
    @DisplayName("POST /cart/clearCart — should empty the cart")
    void clearCart() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername(TEST_USERNAME);

        mockMvc.perform(post("/cart/clearCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    // =========================================================================
    // NOTE CRUD
    // =========================================================================

    @Test
    @Order(50)
    @DisplayName("POST /note/addNote — should create a note for user")
    void addNote() throws Exception {
        CreateNoteRequest request = new CreateNoteRequest();
        request.setTitle("Test Note");
        request.setDescription("This is a test note for integration testing");
        request.setUser(TEST_USERNAME);

        mockMvc.perform(post("/note/addNote")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test Note"));
    }

    @Test
    @Order(51)
    @DisplayName("POST /note/addNote — note >1000 chars returns 400")
    void addNote_tooLong() throws Exception {
        CreateNoteRequest request = new CreateNoteRequest();
        request.setTitle("Long Note");
        request.setDescription("A".repeat(1001));
        request.setUser(TEST_USERNAME);

        mockMvc.perform(post("/note/addNote")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(52)
    @DisplayName("GET /note/user/{username} — should return user notes")
    void getUserNotes() throws Exception {
        mockMvc.perform(get("/note/user/" + TEST_USERNAME)
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(53)
    @DisplayName("POST /note/addNote — other authenticated user gets 403")
    void addNote_forbiddenForOtherUser() throws Exception {
        CreateNoteRequest request = new CreateNoteRequest();
        request.setTitle("Should Fail");
        request.setDescription("Cross-user write should be blocked");
        request.setUser(TEST_USERNAME);

        mockMvc.perform(post("/note/addNote")
                        .header("Authorization", jwtTokenOtherUser)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(54)
    @DisplayName("POST /note/updateNote — should update note title and description")
    void updateNote() throws Exception {
        User user = userRepository.findByUsername(TEST_USERNAME);
        List<Note> notes = noteRepository.findByUserid(user.getId());
        Note target = notes.stream()
                .filter(n -> "Test Note".equals(n.getTitle()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected seed note not found"));

        UpdateNoteRequest request = new UpdateNoteRequest();
        request.setId(target.getId());
        request.setTitle("Updated Test Note");
        request.setDescription("Updated description from integration test");

        mockMvc.perform(post("/note/updateNote")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(target.getId()))
                .andExpect(jsonPath("$.title").value("Updated Test Note"))
                .andExpect(jsonPath("$.description").value("Updated description from integration test"));

        Note updated = noteRepository.findById(target.getId()).orElseThrow();
        assertEquals("Updated Test Note", updated.getTitle());
    }

    @Test
    @Order(55)
    @DisplayName("DELETE /note/delete/{id} — should delete note")
    void deleteNote() throws Exception {
        User user = userRepository.findByUsername(TEST_USERNAME);
        Note target = noteRepository.findByUserid(user.getId()).stream()
                .filter(n -> "Updated Test Note".equals(n.getTitle()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected updated note not found"));

        mockMvc.perform(delete("/note/delete/" + target.getId())
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk());

        assertFalse(noteRepository.findById(target.getId()).isPresent());
    }

    @Test
    @Order(56)
    @DisplayName("POST /user/user-change-password — requires current password and updates password")
    void changePasswordRequiresCurrentPasswordAndUpdatesPassword() throws Exception {
        String updatedPassword = "securePass456";

        ChangePasswordRequest wrongCurrentPasswordRequest = new ChangePasswordRequest();
        wrongCurrentPasswordRequest.setCurrentPassword("wrongPassword");
        wrongCurrentPasswordRequest.setNewPassword(updatedPassword);
        wrongCurrentPasswordRequest.setConfirmNewPassword(updatedPassword);

        mockMvc.perform(post("/user/user-change-password")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongCurrentPasswordRequest)))
                .andExpect(status().isUnauthorized());

        ChangePasswordRequest changePasswordRequest = new ChangePasswordRequest();
        changePasswordRequest.setCurrentPassword(TEST_PASSWORD);
        changePasswordRequest.setNewPassword(updatedPassword);
        changePasswordRequest.setConfirmNewPassword(updatedPassword);

        mockMvc.perform(post("/user/user-change-password")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changePasswordRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(TEST_USERNAME))
                .andExpect(jsonPath("$.message").value("Password updated"));

        LoginRequest oldPasswordLogin = new LoginRequest();
        oldPasswordLogin.setUsername(TEST_USERNAME);
        oldPasswordLogin.setPassword(TEST_PASSWORD);

        mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oldPasswordLogin)))
                .andExpect(status().isUnauthorized());

        LoginRequest newPasswordLogin = new LoginRequest();
        newPasswordLogin.setUsername(TEST_USERNAME);
        newPasswordLogin.setPassword(updatedPassword);

        MvcResult reloginResult = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPasswordLogin)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        jwtToken = extractAuthCookieToken(reloginResult);
        assertNotNull(jwtToken, "JWT token should be returned after password change");
    }

    @Test
    @Order(57)
    @DisplayName("POST /cart/getCart — cookie auth requires CSRF token for unsafe requests")
    void cookieAuthUnsafePostRequiresCsrfToken() throws Exception {
        mockMvc.perform(post("/cart/getCart")
                        .cookie(new Cookie("CLOUDAPP_AUTH", jwtCookieToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME))))
                .andExpect(status().isForbidden());

        String csrfToken = fetchCsrfTokenForAuthCookie(jwtCookieToken);

        mockMvc.perform(post("/cart/getCart")
                        .cookie(new Cookie("CLOUDAPP_AUTH", jwtCookieToken), new Cookie("XSRF-TOKEN", csrfToken))
                        .header("X-XSRF-TOKEN", csrfToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    // =========================================================================
    // PROTECTED ENDPOINT ACCESS
    // =========================================================================

    @Test
    @Order(60)
    @DisplayName("GET /item — unauthenticated request returns 401/403")
    void unauthenticatedAccess() throws Exception {
        mockMvc.perform(get("/item"))
                .andExpect(status().is(anyOf(equalTo(401), equalTo(403))));
    }

    @Test
    @Order(61)
    @DisplayName("GET /item — invalid JWT returns 401/403")
    void invalidJwtAccess() throws Exception {
        mockMvc.perform(get("/item")
                        .header("Authorization", "Bearer invalid.token.here"))
                .andExpect(status().is(anyOf(equalTo(401), equalTo(403))));
    }

    @Test
    @Order(62)
    @DisplayName("POST /user/user-logout — clears auth cookie and cleared cookie no longer authenticates")
    void logoutClearsCookie() throws Exception {
        String csrfToken = fetchCsrfTokenForAuthCookie(jwtCookieToken);
        MvcResult logoutResult = mockMvc.perform(post("/user/user-logout")
                        .cookie(new Cookie("CLOUDAPP_AUTH", jwtCookieToken), new Cookie("XSRF-TOKEN", csrfToken))
                        .header("X-XSRF-TOKEN", csrfToken))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        String clearedCookieHeader = logoutResult.getResponse().getHeaders("Set-Cookie").stream()
                .filter(header -> header != null && header.startsWith("CLOUDAPP_AUTH="))
                .findFirst()
                .orElse(null);
        assertNotNull(clearedCookieHeader, "Logout should emit a CLOUDAPP_AUTH Set-Cookie header");
        assertTrue(clearedCookieHeader.contains("CLOUDAPP_AUTH="), "Logout should clear CLOUDAPP_AUTH cookie");
        assertTrue(clearedCookieHeader.contains("Max-Age=0"), "Logout cookie should expire immediately");
        assertTrue(clearedCookieHeader.contains("HttpOnly"), "Logout cookie should remain HttpOnly");

        mockMvc.perform(get("/user/" + TEST_USERNAME)
                        .cookie(new Cookie("CLOUDAPP_AUTH", "")))
                .andExpect(status().is(anyOf(equalTo(401), equalTo(403))));
    }

    @Test
    @Order(63)
    @DisplayName("POST /user/admin/roles — rejects unsupported roles with 400")
    void adminRoles_rejectsUnsupportedRoleNames() throws Exception {
        Map<String, Object> request = Map.of(
                "username", TEST_USERNAME,
                "roles", List.of("ADMIN", "SUPERADMIN")
        );

        mockMvc.perform(post("/user/admin/roles")
                        .header("Authorization", ensureAdminJwtToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("Unsupported role")));

        User user = userRepository.findByUsername(TEST_USERNAME);
        assertNotNull(user);
        assertNotNull(user.getRoles());
        assertFalse(user.getRoles().contains("ROLE_SUPERADMIN"));
        assertTrue(user.getRoles().contains("ROLE_USER"));
    }

    @Test
    @Order(64)
    @DisplayName("POST /user/admin/roles — admin can demote user and new JWT loses ROLE_ADMIN")
    void adminRoles_adminDemotesUserAndNewJwtLosesAdmin() throws Exception {
        Map<String, Object> request = Map.of(
                "username", OTHER_USERNAME,
                "roles", List.of("USER")
        );

        mockMvc.perform(post("/user/admin/roles")
                        .header("Authorization", ensureAdminJwtToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(OTHER_USERNAME))
                .andExpect(jsonPath("$.roles", hasItem("ROLE_USER")))
                .andExpect(jsonPath("$.roles", not(hasItem("ROLE_ADMIN"))));

        User demotedUser = userRepository.findByUsername(OTHER_USERNAME);
        assertNotNull(demotedUser);
        assertNotNull(demotedUser.getRoles());
        assertFalse(demotedUser.getRoles().contains("ROLE_ADMIN"), "Demoted user should no longer persist ROLE_ADMIN");

        LoginRequest login = new LoginRequest();
        login.setUsername(OTHER_USERNAME);
        login.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        String demotedJwtToken = extractAuthCookieToken(result);
        assertNotNull(demotedJwtToken);

        List<String> demotedRoles = jwtUtilities.getRoles(demotedJwtToken);
        assertTrue(demotedRoles.contains("ROLE_USER"), "Demoted user JWT should keep ROLE_USER");
        assertFalse(demotedRoles.contains("ROLE_ADMIN"), "Demoted user JWT should not include ROLE_ADMIN");

        mockMvc.perform(get("/user/admin/users")
                        .header("Authorization", demotedJwtToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(65)
    @DisplayName("PUT /item/{id} — non-admin forbidden, admin can update item")
    void updateItem_adminOnly() throws Exception {
        ensureWidgetAExists();
        Item item = itemRepository.findByName("Widget A").get(0);

        CreateItemRequest updateRequest = new CreateItemRequest();
        updateRequest.setName("Widget A Updated");
        updateRequest.setPrice(new BigDecimal("21.99"));
        updateRequest.setDescription("Updated description");

        mockMvc.perform(put("/item/" + item.getId())
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/item/" + item.getId())
                        .header("Authorization", ensureAdminJwtToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(item.getId()))
                .andExpect(jsonPath("$.name").value("Widget A Updated"))
                .andExpect(jsonPath("$.price").value(21.99))
                .andExpect(jsonPath("$.description").value("Updated description"));
    }

    @Test
    @Order(66)
    @DisplayName("DELETE /item/{id} — non-admin forbidden, admin can delete item")
    void deleteItem_adminOnly() throws Exception {
        Item temporaryItem = new Item();
        temporaryItem.setName("Widget To Delete");
        temporaryItem.setPrice(new BigDecimal("9.99"));
        temporaryItem.setDescription("Temp delete item");
        temporaryItem = itemRepository.save(temporaryItem);

        mockMvc.perform(delete("/item/" + temporaryItem.getId())
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/item/" + temporaryItem.getId())
                        .header("Authorization", ensureAdminJwtToken()))
                .andExpect(status().isOk());

        assertFalse(itemRepository.findById(temporaryItem.getId()).isPresent(), "Admin delete should remove item");
    }

    @Test
    @Order(100)
    void duplicateRegistrationDoesNotChangeExistingAccount() throws Exception {
        User before = userRepository.findByUsername(TEST_USERNAME);
        mockMvc.perform(post("/user/user-register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME,
                        "password", "anotherPassword123", "confirmPassword", "anotherPassword123"))))
                .andExpect(status().isConflict());
        User after = userRepository.findByUsername(TEST_USERNAME);
        assertEquals(before.getId(), after.getId());
        assertEquals(before.getPassword(), after.getPassword());
        assertEquals(before.getCart().getId(), after.getCart().getId());
    }

    @Test
    @Order(101)
    void createItemRequiresAdministrator() throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of("name", "Acceptance catalog item",
                "description", "Created through the API", "price", 12.50));
        mockMvc.perform(post("/item").header("Authorization", jwtToken)
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isForbidden());
        assertTrue(itemRepository.findByName("Acceptance catalog item").isEmpty());
        mockMvc.perform(post("/item").header("Authorization", ensureAdminJwtToken())
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isOk());
        assertEquals(1, itemRepository.findByName("Acceptance catalog item").size());
    }

    @Test
    @Order(102)
    void noteLifecycleRefreshesOwnedListAtDescriptionBoundary() throws Exception {
        for (String description : List.of("", "A description", "x".repeat(999))) {
            MvcResult created = mockMvc.perform(post("/note/addNote").header("Authorization", jwtToken)
                    .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                            Map.of("user", TEST_USERNAME, "title", "Acceptance note", "description", description))))
                    .andExpect(status().isOk()).andReturn();
            long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();
            mockMvc.perform(get("/note/user/" + TEST_USERNAME).header("Authorization", jwtToken))
                    .andExpect(jsonPath("$[?(@.id == " + id + ")].description").value(hasItem(description)));
            mockMvc.perform(post("/note/updateNote").header("Authorization", jwtToken)
                    .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                            Map.of("id", id, "title", "Updated acceptance note", "description", "changed"))))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/note/user/" + TEST_USERNAME).header("Authorization", jwtToken))
                    .andExpect(jsonPath("$[?(@.id == " + id + ")].title").value(hasItem("Updated acceptance note")));
            mockMvc.perform(delete("/note/delete/" + id).header("Authorization", jwtToken)).andExpect(status().isOk());
            mockMvc.perform(get("/note/user/" + TEST_USERNAME).header("Authorization", jwtToken))
                    .andExpect(jsonPath("$[?(@.id == " + id + ")]").isEmpty());
            assertFalse(noteRepository.existsById(id));
        }
    }

    @Test
    @Order(103)
    void notesAndFilesDenyCrossUserListsAndRecordMutations() throws Exception {
        User owner = userRepository.findByUsername(TEST_USERNAME);
        Note note = noteRepository.save(new Note("Private", "secret", owner.getId()));
        File file = fileRepository.save(new File("private.txt", "text/plain", "6", owner.getId(), "secret".getBytes()));
        for (String path : List.of("/note/user/", "/file/user/")) {
            mockMvc.perform(get(path + TEST_USERNAME).header("Authorization", jwtTokenOtherUser)).andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/note/updateNote").header("Authorization", jwtTokenOtherUser)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                        Map.of("id", note.getId(), "title", "stolen", "description", "changed"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/note/delete/" + note.getId()).header("Authorization", jwtTokenOtherUser)).andExpect(status().isForbidden());
        mockMvc.perform(get("/file/get-file/" + file.getFileId()).header("Authorization", jwtTokenOtherUser)).andExpect(status().isForbidden());
        mockMvc.perform(delete("/file/delete-file/" + file.getFileId()).header("Authorization", jwtTokenOtherUser)).andExpect(status().isForbidden());
        mockMvc.perform(multipart("/file/upload").file(new MockMultipartFile("fileUpload", "intruder.txt", "text/plain", new byte[]{1}))
                .param("username", TEST_USERNAME).header("Authorization", jwtTokenOtherUser)).andExpect(status().isForbidden());
        assertEquals("secret", noteRepository.findById(note.getId()).orElseThrow().getDescription());
        assertArrayEquals("secret".getBytes(), fileRepository.findById(file.getFileId()).orElseThrow().getFileData());
        noteRepository.delete(note);
        fileRepository.delete(file);
    }

    @Test
    @Order(104)
    void fileLifecyclePersistsBytesAndAllowsMaximumSize() throws Exception {
        for (int size : List.of(1, 2_000_000)) {
            byte[] data = new byte[size];
            java.util.Arrays.fill(data, (byte) 42);
            String filename = "acceptance-" + size + ".bin";
            mockMvc.perform(multipart("/file/upload").file(new MockMultipartFile("fileUpload", filename, "application/octet-stream", data))
                    .param("username", TEST_USERNAME).header("Authorization", jwtToken)).andExpect(status().isOk());
            File stored = fileRepository.findByUserid(userRepository.findByUsername(TEST_USERNAME).getId()).stream()
                    .filter(f -> filename.equals(f.getFileName())).findFirst().orElseThrow();
            mockMvc.perform(get("/file/user/" + TEST_USERNAME).header("Authorization", jwtToken))
                    .andExpect(jsonPath("$[*].fileName").value(hasItem(filename)));
            mockMvc.perform(get("/file/get-file/" + stored.getFileId()).header("Authorization", jwtToken))
                    .andExpect(status().isOk()).andExpect(content().bytes(data));
            mockMvc.perform(delete("/file/delete-file/" + stored.getFileId()).header("Authorization", jwtToken)).andExpect(status().isOk());
            mockMvc.perform(get("/file/user/" + TEST_USERNAME).header("Authorization", jwtToken))
                    .andExpect(jsonPath("$[*].fileName").value(not(hasItem(filename))));
            assertFalse(fileRepository.existsById(stored.getFileId()));
        }
    }

    @Test
    @Order(105)
    void invalidFileUploadsDoNotPersistAndDuplicateNamesAreUserScoped() throws Exception {
        long before = fileRepository.count();
        for (MockMultipartFile invalid : List.of(
                new MockMultipartFile("fileUpload", "empty.txt", "text/plain", new byte[0]),
                new MockMultipartFile("fileUpload", "large.txt", "text/plain", new byte[2_000_001]),
                new MockMultipartFile("fileUpload", "", "text/plain", new byte[]{1}))) {
            mockMvc.perform(multipart("/file/upload").file(invalid).param("username", TEST_USERNAME)
                    .header("Authorization", jwtToken)).andExpect(status().isBadRequest());
        }
        assertEquals(before, fileRepository.count());
        MockMultipartFile upload = new MockMultipartFile("fileUpload", "shared-name.txt", "text/plain", new byte[]{1});
        mockMvc.perform(multipart("/file/upload").file(upload).param("username", TEST_USERNAME).header("Authorization", jwtToken)).andExpect(status().isOk());
        mockMvc.perform(multipart("/file/upload").file(upload).param("username", TEST_USERNAME).header("Authorization", jwtToken)).andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/file/upload").file(upload).param("username", OTHER_USERNAME).header("Authorization", jwtTokenOtherUser)).andExpect(status().isOk());
        assertEquals(before + 2, fileRepository.count());
    }

    @Test
    @Order(106)
    void personalCartAndCheckoutPersistWithoutChangingAnotherUsersCart() throws Exception {
        Item item = itemRepository.findByName("Acceptance catalog item").get(0);
        String request = objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME, "itemId", item.getId(), "quantity", 2));
        mockMvc.perform(post("/cart/clearCart").header("Authorization", jwtToken).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME)))).andExpect(status().isOk());
        MvcResult otherBefore = mockMvc.perform(post("/cart/getCart").header("Authorization", jwtTokenOtherUser)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("username", OTHER_USERNAME))))
                .andExpect(status().isOk()).andReturn();
        mockMvc.perform(post("/cart/addToCart").header("Authorization", jwtToken).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(25.0)).andExpect(jsonPath("$.items.length()").value(2));
        MvcResult order = mockMvc.perform(post("/order/submit/" + TEST_USERNAME).header("Authorization", jwtToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(25.0)).andExpect(jsonPath("$.items.length()").value(2)).andReturn();
        long orderId = objectMapper.readTree(order.getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(post("/cart/clearCart").header("Authorization", jwtToken).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("username", TEST_USERNAME))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.total").value(0));
        mockMvc.perform(get("/order/history/" + TEST_USERNAME).header("Authorization", jwtToken))
                .andExpect(jsonPath("$[?(@.id == " + orderId + ")].total").value(hasItem(25.0)));
        assertTrue(orderRepository.existsById(orderId));
        MvcResult otherAfter = mockMvc.perform(post("/cart/getCart").header("Authorization", jwtTokenOtherUser)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("username", OTHER_USERNAME))))
                .andExpect(status().isOk()).andReturn();
        assertEquals(objectMapper.readTree(otherBefore.getResponse().getContentAsString()), objectMapper.readTree(otherAfter.getResponse().getContentAsString()));
    }

    @Test
    @Order(107)
    void roomCreationAndLookupPersistTheSameCode() throws Exception {
        MvcResult created = mockMvc.perform(post("/room").header("Authorization", jwtToken)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(
                        Map.of("username", TEST_USERNAME, "name", "Acceptance live room"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.err_code").value(0)).andReturn();
        String code = objectMapper.readTree(created.getResponse().getContentAsString()).path("data").path("code").asText();
        assertFalse(code.isBlank());
        mockMvc.perform(get("/room/" + code).header("Authorization", jwtTokenOtherUser))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.code").value(code))
                .andExpect(jsonPath("$.data.name").value("Acceptance live room"));
    }

    @Test
    @Order(108)
    void realStompMessageTraversesKafkaAndBroadcastsToRoomSubscribers() throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new SockJsClient(
                List.of(new WebSocketTransport(new StandardWebSocketClient()))));
        client.setMessageConverter(new MappingJackson2MessageConverter());
        String code = "acceptance-" + java.util.UUID.randomUUID();
        LinkedBlockingQueue<com.example.demo.model.persistence.model.Message> received = new LinkedBlockingQueue<>();
        StompSession session = null;
        try {
            session = client.connectAsync("ws://localhost:" + serverPort + "/cloudapp/ws", new WebSocketHttpHeaders(),
                    new StompSessionHandlerAdapter() {}).get(10, TimeUnit.SECONDS);
            session.subscribe("/topic/group/" + code, new StompFrameHandler() {
                public Type getPayloadType(StompHeaders headers) { return com.example.demo.model.persistence.model.Message.class; }
                public void handleFrame(StompHeaders headers, Object payload) {
                    received.add((com.example.demo.model.persistence.model.Message) payload);
                }
            });
            com.example.demo.model.persistence.model.Message message = new com.example.demo.model.persistence.model.Message();
            message.setSender(TEST_USERNAME);
            message.setContent("Acceptance message via Kafka");
            session.send("/app/sendMessage/" + code, message);
            var result = received.poll(15, TimeUnit.SECONDS);
            assertNotNull(result, "The real room subscriber must receive the Kafka broadcast");
            assertEquals(TEST_USERNAME, result.getSender());
            assertEquals("Acceptance message via Kafka", result.getContent());
            assertTrue(result.getTimestamp() > 0);
        } finally {
            if (session != null && session.isConnected()) session.disconnect();
            client.stop();
        }
    }

    @Test
    @Order(109)
    void productionMigrationWidensNotesAndPreservesExistingDescriptions() {
        String schema = "acceptance_" + java.util.UUID.randomUUID().toString().replace("-", "");
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(dataSource);
        try {
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema)
                    .defaultSchema(schema).locations("classpath:db/migration").target("3").load().migrate();
            jdbc.update("INSERT INTO " + schema + ".notes (title, description, userid) VALUES (?, ?, ?)",
                    "Existing note", "Preserved text", 1L);
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema)
                    .defaultSchema(schema).locations("classpath:db/migration").load().migrate();
            assertEquals("Preserved text", jdbc.queryForObject("SELECT description FROM " + schema + ".notes", String.class));
            String description = "x".repeat(999);
            jdbc.update("UPDATE " + schema + ".notes SET description = ?", description);
            assertEquals(description, jdbc.queryForObject("SELECT description FROM " + schema + ".notes", String.class));
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }

    private String fetchCsrfTokenForAuthCookie(String authCookieToken) throws Exception {
        MvcResult csrfResult = mockMvc.perform(get("/user/csrf-token")
                        .cookie(new Cookie("CLOUDAPP_AUTH", authCookieToken)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        Cookie csrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(csrfCookie, "CSRF cookie should be returned");
        assertNotNull(csrfCookie.getValue(), "CSRF cookie should contain a token");
        return csrfCookie.getValue();
    }

    private void ensureWidgetAExists() {
        if (!itemRepository.findByName("Widget A").isEmpty()) {
            return;
        }
        Item item = new Item();
        item.setName("Widget A");
        item.setPrice(new BigDecimal("19.99"));
        item.setDescription("A high-quality widget");
        itemRepository.save(item);
    }

    private String ensureAdminJwtToken() throws Exception {
        if (adminJwtToken != null && !adminJwtToken.isBlank()) {
            return adminJwtToken;
        }

        CreateUserRequest register = new CreateUserRequest();
        register.setUsername(ADMIN_USERNAME);
        register.setPassword(TEST_PASSWORD);
        register.setConfirmPassword(TEST_PASSWORD);

        int registerStatus = mockMvc.perform(post("/user/user-register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andReturn()
                .getResponse()
                .getStatus();
        assertTrue(
                registerStatus == 200 || registerStatus == 409,
                "Admin bootstrap user registration should succeed or already exist"
        );

        LoginRequest login = new LoginRequest();
        login.setUsername(ADMIN_USERNAME);
        login.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        adminJwtToken = extractAuthCookieToken(result);
        assertNotNull(adminJwtToken);
        return adminJwtToken;
    }

    private String findAuthCookieHeader(MvcResult result) {
        return result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(header -> header != null && header.startsWith("CLOUDAPP_AUTH="))
                .findFirst()
                .orElse(null);
    }

    private String extractAuthCookieToken(MvcResult result) {
        String authCookieHeader = findAuthCookieHeader(result);
        assertNotNull(authCookieHeader, "Expected CLOUDAPP_AUTH Set-Cookie header");
        return authCookieHeader.split(";", 2)[0].substring("CLOUDAPP_AUTH=".length());
    }
}
