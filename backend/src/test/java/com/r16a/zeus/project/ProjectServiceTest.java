package com.r16a.zeus.project;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.r16a.zeus.project.repository.ProjectRepository;
import com.r16a.zeus.project.exception.ProjectConflictException;
import com.r16a.zeus.project.service.ProjectService;
import com.r16a.zeus.team.repository.TeamRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {
    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TeamRepository teamRepository;

    @InjectMocks
    private ProjectService projectService;

    @Test
    void createProjectRequiresExistingTeam() {
        UUID teamId = UUID.randomUUID();
        Project project = Project.builder().name("P1").teamId(teamId).build();

        when(teamRepository.existsById(teamId)).thenReturn(false);

        assertThrows(ProjectConflictException.class, () -> projectService.createProject(project));
    }

    @Test
    void deleteProjectRejectsDeletingLastProjectForTeam() {
        UUID projectId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Project project = Project.builder().id(projectId).teamId(teamId).name("P1").build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.countByTeamId(teamId)).thenReturn(1L);

        assertThrows(ProjectConflictException.class, () -> projectService.deleteProject(projectId));
        verify(projectRepository, never()).deleteById(projectId);
    }
}
