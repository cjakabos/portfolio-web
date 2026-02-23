package com.example.demo;

import com.example.demo.model.persistence.*;
import com.example.demo.model.persistence.repositories.*;
import com.example.demo.model.requests.*;
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

import java.math.BigDecimal;
import java.util.List;

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
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
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

    private String jwtToken;
    private String jwtCookieToken;
    private String jwtTokenOtherUser;
    private static final String TEST_USERNAME = "integrationuser";
    private static final String TEST_PASSWORD = "securePass123";
    private static final String OTHER_USERNAME = "integrationuser2";

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
    }

    @Test
    @Order(4)
    @DisplayName("POST /user/user-login — valid credentials return JWT in header")
    void login_happyPath() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(TEST_USERNAME);
        loginRequest.setPassword(TEST_PASSWORD);

        MvcResult result = mockMvc.perform(post("/user/user-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Authorization"))
                .andReturn();

        jwtToken = result.getResponse().getHeader("Authorization");
        assertNotNull(jwtToken, "JWT token should be returned in Authorization header");
        assertFalse(jwtToken.isEmpty(), "JWT token should not be empty");

        String authCookieHeader = result.getResponse().getHeader("Set-Cookie");
        assertNotNull(authCookieHeader, "JWT auth cookie should be returned in Set-Cookie header");
        assertTrue(authCookieHeader.contains("CLOUDAPP_AUTH="), "Set-Cookie should include CLOUDAPP_AUTH");
        assertTrue(authCookieHeader.contains("HttpOnly"), "Auth cookie should be HttpOnly");
        jwtCookieToken = authCookieHeader.split(";", 2)[0].substring("CLOUDAPP_AUTH=".length());
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
                .andExpect(header().exists("Authorization"))
                .andReturn();

        jwtTokenOtherUser = result.getResponse().getHeader("Authorization");
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
    @DisplayName("POST /item — should create item in Postgres")
    void createItem() throws Exception {
        CreateItemRequest request = new CreateItemRequest();
        request.setName("Widget A");
        request.setPrice(new BigDecimal("19.99"));
        request.setDescription("A high-quality widget");

        mockMvc.perform(post("/item")
                        .header("Authorization", jwtToken)
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
    @Order(11)
    @DisplayName("GET /item — should return all items")
    void getItems() throws Exception {
        mockMvc.perform(get("/item")
                        .header("Authorization", jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(12)
    @DisplayName("GET /item/{id} — should return item by ID")
    void getItemById() throws Exception {
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
    @DisplayName("POST /cart/addToCart — nonexistent user returns 404")
    void addToCart_noUser() throws Exception {
        ModifyCartRequest request = new ModifyCartRequest();
        request.setUsername("ghostuser");
        request.setItemId(1L);
        request.setQuantity(1);

        mockMvc.perform(post("/cart/addToCart")
                        .header("Authorization", jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
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
}
