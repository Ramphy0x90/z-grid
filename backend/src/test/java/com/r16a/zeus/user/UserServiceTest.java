package com.r16a.zeus.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.r16a.zeus.core.security.authorization.Role;
import com.r16a.zeus.team.service.TeamMembershipService;
import java.util.Set;
import java.util.UUID;

import com.r16a.zeus.user.repository.UserRepository;
import com.r16a.zeus.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamMembershipService teamMembershipService;

    @InjectMocks
    private UserService userService;

    @Test
    void createUserAssignsUuidAndDefaultRole() {
        User user = User.builder()
                .email("user@example.com")
                .fullName("Test User")
                .active(true)
                .build();
        UUID teamId = UUID.randomUUID();

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User created = userService.createUser(user, Set.of(teamId));

        assertNotNull(created.getId());
        assertEquals(Role.USER, created.getRole());
        verify(teamMembershipService, times(1)).addUserToTeam(created.getId(), teamId);
    }

    @Test
    void createUserRequiresAtLeastOneTeam() {
        User user = User.builder().email("user@example.com").fullName("No Team").build();

        assertThrows(IllegalArgumentException.class, () -> userService.createUser(user, Set.of()));
    }
}
