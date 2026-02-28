package com.r16a.zeus.team;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.r16a.zeus.team.repository.TeamRepository;
import com.r16a.zeus.team.repository.UserTeamMembershipRepository;
import com.r16a.zeus.team.service.TeamMembershipService;
import com.r16a.zeus.user.repository.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TeamMembershipServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private UserTeamMembershipRepository membershipRepository;

    @InjectMocks
    private TeamMembershipService teamMembershipService;

    @Test
    void removeMembershipRejectsLastTeamForUser() {
        UUID userId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();

        when(membershipRepository.existsMembership(userId, teamId)).thenReturn(true);
        when(membershipRepository.countTeamsForUser(userId)).thenReturn(1L);

        assertThrows(IllegalStateException.class, () -> teamMembershipService.removeUserFromTeam(userId, teamId));
        verify(membershipRepository, never()).deleteMembership(userId, teamId);
    }

    @Test
    void removeMembershipRejectsLastUserForTeam() {
        UUID userId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();

        when(membershipRepository.existsMembership(userId, teamId)).thenReturn(true);
        when(membershipRepository.countTeamsForUser(userId)).thenReturn(2L);
        when(membershipRepository.countUsersForTeam(teamId)).thenReturn(1L);

        assertThrows(IllegalStateException.class, () -> teamMembershipService.removeUserFromTeam(userId, teamId));
        verify(membershipRepository, never()).deleteMembership(userId, teamId);
    }
}
