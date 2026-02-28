package com.r16a.zeus.user.service;

import com.r16a.zeus.core.security.authorization.Role;
import com.r16a.zeus.team.service.TeamMembershipService;
import com.r16a.zeus.user.User;
import com.r16a.zeus.user.exception.UserNotFoundException;
import com.r16a.zeus.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final TeamMembershipService teamMembershipService;

    public Optional<User> findUserById(UUID id) {
        return userRepository.findById(id);
    }

    public User getUserByIdOrThrow(UUID id) {
        return findUserById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
    }

    public Optional<User> findUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public User getUserByUsernameOrThrow(String username) {
        return findUserByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found for username: " + username));
    }

    public List<User> getUsers() {
        List<User> users = new ArrayList<>();
        userRepository.findAll().forEach(users::add);
        return users;
    }

    public List<User> getUsersInTeam(UUID teamId) {
        return userRepository.findAllByTeamId(teamId);
    }

    @Transactional
    public User createUser(User user, Set<UUID> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) {
            throw new IllegalArgumentException("User must belong to at least one team");
        }

        Instant now = Instant.now();
        if (user.getRole() == null) {
            user.setRole(Role.USER);
        }

        if (user.getCreatedAt() == null) {
            user.setCreatedAt(now);
        }

        user.setUpdatedAt(now);

        User saved = userRepository.save(user);
        if (saved.getId() == null) {
            throw new IllegalStateException("User insert did not return an ID");
        }
        teamIds.forEach(teamId -> teamMembershipService.addUserToTeam(saved.getId(), teamId));
        return saved;
    }

    @Transactional
    public User updateUser(UUID id, User update) {
        User existing = getUserByIdOrThrow(id);

        existing.setUsername(update.getUsername());
        existing.setEmail(update.getEmail());
        existing.setFullName(update.getFullName());
        existing.setRole(update.getRole());
        existing.setActive(update.isActive());
        existing.setUpdatedAt(Instant.now());

        return userRepository.save(existing);
    }

    @Transactional
    public void deleteUser(UUID id) {
        userRepository.deleteById(id);
    }
}
