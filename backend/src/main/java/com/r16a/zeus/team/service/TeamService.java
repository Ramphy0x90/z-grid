package com.r16a.zeus.team.service;

import com.r16a.zeus.team.Team;
import com.r16a.zeus.team.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TeamService {
    private final TeamRepository teamRepository;

    @Transactional
    public Team createTeam(Team team) {
        Objects.requireNonNull(team, "team must not be null");
        return teamRepository.save(team);
    }
}
