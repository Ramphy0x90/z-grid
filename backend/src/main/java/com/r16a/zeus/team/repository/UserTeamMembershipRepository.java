package com.r16a.zeus.team.repository;

import java.util.Set;
import java.util.UUID;

import com.r16a.zeus.team.Team;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface UserTeamMembershipRepository extends Repository<Team, UUID> {
    @Query("SELECT EXISTS(SELECT 1 FROM user_teams WHERE user_id = :userId AND team_id = :teamId)")
    boolean existsMembership(UUID userId, UUID teamId);

    @Query("SELECT COUNT(*) FROM user_teams WHERE user_id = :userId")
    long countTeamsForUser(UUID userId);

    @Query("SELECT COUNT(*) FROM user_teams WHERE team_id = :teamId")
    long countUsersForTeam(UUID teamId);

    @Query("SELECT team_id FROM user_teams WHERE user_id = :userId")
    Set<UUID> findTeamIdsByUser(UUID userId);

    @Modifying
    @Query("INSERT INTO user_teams(user_id, team_id) VALUES(:userId, :teamId)")
    int insertMembership(UUID userId, UUID teamId);

    @Modifying
    @Query("DELETE FROM user_teams WHERE user_id = :userId AND team_id = :teamId")
    int deleteMembership(UUID userId, UUID teamId);
}
