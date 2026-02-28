package com.r16a.zeus.user.repository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import com.r16a.zeus.user.User;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

public interface UserRepository extends CrudRepository<User, UUID> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("""
            SELECT u.*
            FROM users u
            JOIN user_teams ut ON ut.user_id = u.id
            WHERE ut.team_id = :teamId
            ORDER BY u.created_at DESC
            """)
    List<User> findAllByTeamId(UUID teamId);
}
