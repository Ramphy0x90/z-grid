package com.r16a.zeus.team.service;

import com.r16a.zeus.team.Team;
import com.r16a.zeus.team.exception.TeamConflictException;
import com.r16a.zeus.team.exception.TeamNotFoundException;
import com.r16a.zeus.team.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TeamService {
    private final TeamRepository teamRepository;

    public Optional<Team> findTeamById(UUID id) {
        return teamRepository.findById(id);
    }

    public Team getTeamByIdOrThrow(UUID id) {
        return findTeamById(id)
                .orElseThrow(() -> new TeamNotFoundException("Team not found: " + id));
    }

    public List<Team> getTeams() {
        List<Team> teams = new ArrayList<>();
        teamRepository.findAll().forEach(teams::add);
        return teams;
    }

    @Transactional
    public Team createTeam(Team team) {
        Objects.requireNonNull(team, "team must not be null");
        return teamRepository.save(team);
    }

    @Transactional
    public Team updateTeam(UUID id, Team update) {
        Objects.requireNonNull(update, "update must not be null");
        Team existing = getTeamByIdOrThrow(id);

        existing.setName(update.getName());
        existing.setDescription(update.getDescription());

        return teamRepository.save(existing);
    }

    @Transactional
    public void deleteTeam(UUID id) {
        Team existing = getTeamByIdOrThrow(id);
        try {
            teamRepository.deleteById(existing.getId());
        } catch (DataIntegrityViolationException ex) {
            throw new TeamConflictException("Team cannot be deleted because it is referenced by other resources");
        }
    }
}
