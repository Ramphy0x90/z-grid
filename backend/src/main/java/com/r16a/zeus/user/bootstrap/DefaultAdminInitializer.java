package com.r16a.zeus.user.bootstrap;

import com.r16a.zeus.core.security.authorization.Role;
import com.r16a.zeus.user.User;
import com.r16a.zeus.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultAdminInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.admin.username:admin}")
    private String defaultAdminUsername;

    @Value("${app.bootstrap.admin.password:password}")
    private String defaultAdminPassword;

    @Value("${app.bootstrap.admin.enabled:true}")
    private boolean bootstrapEnabled;

    @Override
    public void run(String... args) {
        if (!bootstrapEnabled) {
            log.info("Default admin bootstrap is disabled");
            return;
        }

        String adminEmail = defaultAdminUsername + "@zeus.local";
        log.info("Ensuring default admin user '{}' exists", defaultAdminUsername);

        if (userRepository.findByUsername(defaultAdminUsername).isPresent()) {
            log.info("Default admin user '{}' already exists by username", defaultAdminUsername);
            return;
        }

        if (userRepository.findByEmail(adminEmail).isPresent()) {
            log.info("Default admin user '{}' already exists by email '{}'", defaultAdminUsername, adminEmail);
            return;
        }

        Instant now = Instant.now();
        User admin = User.builder()
                .username(defaultAdminUsername)
                .passwordHash(passwordEncoder.encode(defaultAdminPassword))
                .email(adminEmail)
                .fullName("Administrator")
                .role(Role.SUPER_ADMIN)
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        userRepository.save(admin);
        log.info("Created default admin user '{}'", defaultAdminUsername);
    }
}
