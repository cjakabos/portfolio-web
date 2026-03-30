package com.example.demo.config;

import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.MessageEntity;
import com.example.demo.model.persistence.Note;
import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.CartRepository;
import com.example.demo.model.persistence.repositories.FileRepository;
import com.example.demo.model.persistence.repositories.MessageRepository;
import com.example.demo.model.persistence.repositories.NoteRepository;
import com.example.demo.model.persistence.repositories.RoomRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.security.UserRoleAuthorityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoUserSeeder.class);
    private static final String PORTFOLIO_ROOM_CODE = "portfolio-tour-room";
    private static final long PORTFOLIO_ROOM_CREATED_AT = 1_711_962_400_000L;
    private static final long PORTFOLIO_ADMIN_MESSAGE_TIMESTAMP = 1_711_962_460_000L;
    private static final long PORTFOLIO_USER_MESSAGE_TIMESTAMP = 1_711_962_520_000L;

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final NoteRepository noteRepository;
    private final FileRepository fileRepository;
    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserRoleAuthorityService userRoleAuthorityService;

    private final boolean enabled;
    private final boolean demoContentEnabled;
    private final String adminUsername;
    private final String adminPassword;
    private final String regularUsername;
    private final String regularPassword;

    public DemoUserSeeder(
            UserRepository userRepository,
            CartRepository cartRepository,
            NoteRepository noteRepository,
            FileRepository fileRepository,
            RoomRepository roomRepository,
            MessageRepository messageRepository,
            PasswordEncoder passwordEncoder,
            UserRoleAuthorityService userRoleAuthorityService,
            @Value("${cloudapp.seed.demo-users.enabled:false}") boolean enabled,
            @Value("${cloudapp.seed.demo-content.enabled:false}") boolean demoContentEnabled,
            @Value("${cloudapp.seed.demo-users.admin.username:}") String adminUsername,
            @Value("${cloudapp.seed.demo-users.admin.password:}") String adminPassword,
            @Value("${cloudapp.seed.demo-users.regular.username:}") String regularUsername,
            @Value("${cloudapp.seed.demo-users.regular.password:}") String regularPassword
    ) {
        this.userRepository = userRepository;
        this.cartRepository = cartRepository;
        this.noteRepository = noteRepository;
        this.fileRepository = fileRepository;
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.passwordEncoder = passwordEncoder;
        this.userRoleAuthorityService = userRoleAuthorityService;
        this.enabled = enabled;
        this.demoContentEnabled = demoContentEnabled;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.regularUsername = regularUsername;
        this.regularPassword = regularPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }

        log.info("Demo user seeding is enabled for this environment");
        seedOrRefreshUser(adminUsername, adminPassword, List.of("ROLE_ADMIN", "ROLE_USER"));
        seedOrRefreshUser(regularUsername, regularPassword, List.of("ROLE_USER"));

        if (demoContentEnabled) {
            seedOrRefreshPortfolioNote(
                    adminUsername,
                    "Admin Demo Checklist",
                    "Use this account for admin-only routes when you want to show governance and operator capabilities."
            );
            seedOrRefreshPortfolioNote(
                    regularUsername,
                    "Portfolio Tour",
                    "Start with Files & Notes, then Shop, Chat, and finish on Maps for the curated portfolio walkthrough."
            );
            seedOrRefreshPortfolioFile(
                    regularUsername,
                    "portfolio-tour.txt",
                    "Use this downloadable file as the opening artifact for the portfolio walkthrough. It proves the seeded demo state is ready."
            );
            seedOrRefreshPortfolioRoom(
                    PORTFOLIO_ROOM_CODE,
                    "Portfolio Walkthrough",
                    regularUsername
            );
            seedOrRefreshPortfolioMessage(
                    PORTFOLIO_ROOM_CODE,
                    adminUsername,
                    "Welcome to the seeded portfolio room. Use this chat to show the realtime collaboration flow.",
                    PORTFOLIO_ADMIN_MESSAGE_TIMESTAMP
            );
            seedOrRefreshPortfolioMessage(
                    PORTFOLIO_ROOM_CODE,
                    regularUsername,
                    "This room is ready for the default demo path: files, shop, chat, then maps.",
                    PORTFOLIO_USER_MESSAGE_TIMESTAMP
            );
        }
    }

    private void seedOrRefreshUser(String username, String rawPassword, List<String> roles) {
        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            log.warn("Skipping demo user seed because credentials were not provided explicitly");
            return;
        }

        User user = userRepository.findByUsername(username);
        boolean created = (user == null);
        if (created) {
            user = new User();
            user.setUsername(username);
        }

        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRoles(userRoleAuthorityService.normalizeRoleNames(roles));

        if (user.getCart() == null) {
            Cart cart = new Cart();
            cartRepository.save(cart);
            user.setCart(cart);
        }

        userRepository.save(user);
        log.info("{} demo user '{}'", created ? "Created" : "Refreshed", username);
    }

    private void seedOrRefreshPortfolioNote(String username, String title, String description) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.warn("Skipping portfolio note seed because user '{}' was not found", username);
            return;
        }

        Note note = noteRepository.findByUserid(user.getId()).stream()
                .filter(existingNote -> title.equals(existingNote.getTitle()))
                .findFirst()
                .orElseGet(() -> new Note(title, description, user.getId()));

        note.setTitle(title);
        note.setDescription(description);
        note.setUserid(user.getId());
        noteRepository.save(note);
        log.info("Seeded portfolio note '{}' for '{}'", title, username);
    }

    private void seedOrRefreshPortfolioFile(String username, String fileName, String content) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            log.warn("Skipping portfolio file seed because user '{}' was not found", username);
            return;
        }

        byte[] fileBytes = content.getBytes(StandardCharsets.UTF_8);
        File file = fileRepository.findByUserid(user.getId()).stream()
                .filter(existingFile -> fileName.equals(existingFile.getFileName()))
                .findFirst()
                .orElseGet(() -> new File(
                        fileName,
                        "text/plain",
                        String.valueOf(fileBytes.length),
                        user.getId(),
                        fileBytes
                ));

        file.setFileName(fileName);
        file.setContentType("text/plain");
        file.setFileSize(String.valueOf(fileBytes.length));
        file.setUserid(user.getId());
        file.setFileData(fileBytes);
        fileRepository.save(file);
        log.info("Seeded portfolio file '{}' for '{}'", fileName, username);
    }

    private void seedOrRefreshPortfolioRoom(String roomCode, String roomName, String createdByUsername) {
        RoomEntity room = roomRepository.findByCode(roomCode);
        if (room == null) {
            room = new RoomEntity();
            room.setCode(roomCode);
        }

        room.setName(roomName);
        room.setCode(roomCode);
        room.setCreatedBy(createdByUsername);
        room.setCreatedAt(PORTFOLIO_ROOM_CREATED_AT);
        roomRepository.save(room);
        log.info("Seeded portfolio room '{}' ({})", roomName, roomCode);
    }

    private void seedOrRefreshPortfolioMessage(
            String roomCode,
            String sender,
            String content,
            long timestamp
    ) {
        MessageEntity message = messageRepository.findByRoomCode(roomCode).stream()
                .filter(existingMessage -> sender.equals(existingMessage.getSender()))
                .filter(existingMessage -> content.equals(existingMessage.getContent()))
                .findFirst()
                .orElseGet(MessageEntity::new);

        message.setRoomCode(roomCode);
        message.setSender(sender);
        message.setContent(content);
        message.setTimestamp(timestamp);
        messageRepository.save(message);
        log.info("Seeded portfolio message for '{}' in '{}'", sender, roomCode);
    }
}
