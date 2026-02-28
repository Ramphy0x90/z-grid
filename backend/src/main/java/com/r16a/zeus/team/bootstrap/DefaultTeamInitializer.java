package com.r16a.zeus.team.bootstrap;

import com.r16a.zeus.team.Team;
import com.r16a.zeus.team.repository.TeamRepository;
import com.r16a.zeus.team.service.TeamMembershipService;
import com.r16a.zeus.user.User;
import com.r16a.zeus.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class DefaultTeamInitializer implements CommandLineRunner {
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TeamMembershipService teamMembershipService;

    @Value("${app.bootstrap.team.name:Default Team}")
    private String defaultTeamName;

    @Value("${app.bootstrap.team.description:Default workspace team}")
    private String defaultTeamDescription;

    @Value("${app.bootstrap.team.enabled:true}")
    private boolean bootstrapEnabled;

    @Value("${app.bootstrap.admin.username:admin}")
    private String defaultAdminUsername;

    @Override
    public void run(String @NonNull ... args) {
        if (!bootstrapEnabled) {
            log.info("Default team bootstrap is disabled");
            return;
        }

        Team team = teamRepository.findByName(defaultTeamName)
                .orElseGet(this::createDefaultTeam);

        userRepository.findByUsername(defaultAdminUsername)
                .ifPresentOrElse(
                        admin -> ensureAdminMembership(admin, team),
                        () -> log.warn("Default admin user '{}' not found, skipping default team membership", defaultAdminUsername)
                );
    }

    private Team createDefaultTeam() {
        Instant now = Instant.now();
        Team team = Team.builder()
                .name(defaultTeamName)
                .description(defaultTeamDescription)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Team saved = teamRepository.save(team);
        log.info("Created default team '{}'", defaultTeamName);
        return saved;
    }

    private void ensureAdminMembership(User admin, Team team) {
        teamMembershipService.addUserToTeam(admin.getId(), team.getId());
        log.info("Ensured default admin '{}' belongs to default team '{}'", admin.getUsername(), team.getName());
    }
}
