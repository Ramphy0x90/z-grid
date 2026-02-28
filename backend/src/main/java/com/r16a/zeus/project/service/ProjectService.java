package com.r16a.zeus.project.service;

import com.r16a.zeus.project.Project;
import com.r16a.zeus.project.exception.ProjectConflictException;
import com.r16a.zeus.project.exception.ProjectNotFoundException;
import com.r16a.zeus.project.repository.ProjectRepository;
import com.r16a.zeus.team.Team;
import com.r16a.zeus.team.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;

    public Optional<Project> findProjectById(UUID id) {
        return projectRepository.findById(id);
    }

    public Project getProjectByIdOrThrow(UUID id) {
        return findProjectById(id)
                .orElseThrow(() -> new ProjectNotFoundException("Project not found: " + id));
    }

    public List<Project> getProjects() {
        List<Project> projects = new ArrayList<>();
        projectRepository.findAll().forEach(projects::add);
        return projects;
    }

    public List<Project> getProjectsInTeam(UUID teamId) {
        return projectRepository.findAllByTeamId(teamId);
    }

    @Transactional
    public Project createProject(Project project) {
        UUID teamId = project.getTeamId();
        if (teamId == null) {
            Iterator<Team> teams = teamRepository.findAll().iterator();
            teamId = teams.hasNext() ? teams.next().getId() : null;
            project.setTeamId(teamId);
        }

        if (teamId == null || !teamRepository.existsById(teamId)) {
            throw new ProjectConflictException("Project must belong to an existing team");
        }

        return projectRepository.save(project);
    }

    @Transactional
    public Project updateProject(UUID projectId, Project update) {
        Project existing = getProjectByIdOrThrow(projectId);

        existing.setName(update.getName());
        existing.setDescription(update.getDescription());

        return projectRepository.save(existing);
    }

    @Transactional
    public void deleteProject(UUID projectId) {
        Project project = getProjectByIdOrThrow(projectId);

        long teamProjectCount = projectRepository.countByTeamId(project.getTeamId());
        if (teamProjectCount <= 1) {
            throw new ProjectConflictException("Team must have at least one project");
        }

        projectRepository.deleteById(projectId);
    }
}
