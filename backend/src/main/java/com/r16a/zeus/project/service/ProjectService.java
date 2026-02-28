package com.r16a.zeus.project.service;

import com.r16a.zeus.project.Project;
import com.r16a.zeus.project.repository.ProjectRepository;
import com.r16a.zeus.team.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;

    @Transactional
    public Project createProject(Project project) {
        UUID teamId = project.getTeamId();

        if (teamId == null || !teamRepository.existsById(teamId)) {
            throw new IllegalArgumentException("Project must belong to an existing team");
        }

        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        long teamProjectCount = projectRepository.countByTeamId(project.getTeamId());
        if (teamProjectCount <= 1) {
            throw new IllegalStateException("Team must have at least one project");
        }

        projectRepository.deleteById(projectId);
    }
}
