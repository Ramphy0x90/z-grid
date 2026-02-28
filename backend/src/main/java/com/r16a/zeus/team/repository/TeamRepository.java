package com.r16a.zeus.team.repository;

import java.util.UUID;
import java.util.Optional;

import com.r16a.zeus.team.Team;
import org.springframework.data.repository.CrudRepository;

public interface TeamRepository extends CrudRepository<Team, UUID> {
    Optional<Team> findByName(String name);
}
