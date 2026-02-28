package com.r16a.zeus.team.service;

import com.r16a.zeus.team.repository.TeamRepository;
import com.r16a.zeus.team.repository.UserTeamMembershipRepository;
import com.r16a.zeus.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TeamMembershipService {
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final UserTeamMembershipRepository membershipRepository;

    @Transactional
    public void addUserToTeam(UUID userId, UUID teamId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }

        if (!teamRepository.existsById(teamId)) {
            throw new IllegalArgumentException("Team not found: " + teamId);
        }

        if (!membershipRepository.existsMembership(userId, teamId)) {
            membershipRepository.insertMembership(userId, teamId);
        }
    }

    @Transactional
    public void removeUserFromTeam(UUID userId, UUID teamId) {
        if (!membershipRepository.existsMembership(userId, teamId)) {
            throw new IllegalArgumentException("Membership does not exist for user/team");
        }

        long userTeamCount = membershipRepository.countTeamsForUser(userId);
        if (userTeamCount <= 1) {
            throw new IllegalStateException("User must belong to at least one team");
        }

        long teamUserCount = membershipRepository.countUsersForTeam(teamId);
        if (teamUserCount <= 1) {
            throw new IllegalStateException("Team must have at least one user");
        }

        membershipRepository.deleteMembership(userId, teamId);
    }

    public long countTeamsForUser(UUID userId) {
        return membershipRepository.countTeamsForUser(userId);
    }

    public long countUsersForTeam(UUID teamId) {
        return membershipRepository.countUsersForTeam(teamId);
    }

    public Set<UUID> findTeamIdsByUser(UUID userId) {
        return membershipRepository.findTeamIdsByUser(userId);
    }
}
