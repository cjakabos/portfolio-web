package com.example.demo.config;

import com.example.demo.model.persistence.Cart;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.CartRepository;
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

import java.util.List;

@Component
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoUserSeeder.class);

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserRoleAuthorityService userRoleAuthorityService;

    private final boolean enabled;
    private final String adminUsername;
    private final String adminPassword;
    private final String regularUsername;
    private final String regularPassword;

    public DemoUserSeeder(
            UserRepository userRepository,
            CartRepository cartRepository,
            PasswordEncoder passwordEncoder,
            UserRoleAuthorityService userRoleAuthorityService,
            @Value("${cloudapp.seed.demo-users.enabled:false}") boolean enabled,
            @Value("${cloudapp.seed.demo-users.admin.username:cloudadmin}") String adminUsername,
            @Value("${cloudapp.seed.demo-users.admin.password:cloudy}") String adminPassword,
            @Value("${cloudapp.seed.demo-users.regular.username:regularuser123}") String regularUsername,
            @Value("${cloudapp.seed.demo-users.regular.password:456789}") String regularPassword
    ) {
        this.userRepository = userRepository;
        this.cartRepository = cartRepository;
        this.passwordEncoder = passwordEncoder;
        this.userRoleAuthorityService = userRoleAuthorityService;
        this.enabled = enabled;
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

        seedOrRefreshUser(adminUsername, adminPassword, List.of("ROLE_ADMIN", "ROLE_USER"));
        seedOrRefreshUser(regularUsername, regularPassword, List.of("ROLE_USER"));
    }

    private void seedOrRefreshUser(String username, String rawPassword, List<String> roles) {
        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            log.warn("Skipping demo user seed because username/password is blank");
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
}
