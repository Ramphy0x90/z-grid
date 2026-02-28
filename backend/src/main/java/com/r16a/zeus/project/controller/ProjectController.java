package com.r16a.zeus.project.controller;

import com.r16a.zeus.project.Project;
import com.r16a.zeus.project.dto.CreateProjectRequest;
import com.r16a.zeus.project.dto.ProjectResponse;
import com.r16a.zeus.project.dto.UpdateProjectRequest;
import com.r16a.zeus.project.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/project")
@RequiredArgsConstructor
@Tag(name = "Project", description = "Project management endpoints")
public class ProjectController {
    private final ProjectService projectService;

    @GetMapping("/{id}")
    @Operation(summary = "Get project by ID", description = "Fetches a single project by its unique ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Project found"),
            @ApiResponse(responseCode = "404", description = "Project not found", content = @Content)
    })
    public ProjectResponse getProjectById(@PathVariable UUID id) {
        return ProjectResponse.from(projectService.getProjectByIdOrThrow(id));
    }

    @GetMapping
    @Operation(summary = "Get projects", description = "Fetches all projects")
    @ApiResponse(responseCode = "200", description = "Projects retrieved")
    public List<ProjectResponse> getProjects() {
        return projectService.getProjects()
                .stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @GetMapping("/team/{teamId}")
    @Operation(summary = "Get projects in team", description = "Fetches all projects belonging to the specified team")
    @ApiResponse(responseCode = "200", description = "Projects retrieved")
    public List<ProjectResponse> getProjectsInTeam(@PathVariable UUID teamId) {
        return projectService.getProjectsInTeam(teamId)
                .stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @PostMapping
    @Operation(summary = "Create project", description = "Creates a new project associated with an existing team")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Project created"),
            @ApiResponse(responseCode = "409", description = "Project cannot be created because of team constraints",
                    content = @Content(schema = @Schema(implementation = String.class)))
    })
    public ResponseEntity<ProjectResponse> createProject(@Valid @RequestBody CreateProjectRequest request) {
        Project projectToCreate = Project.builder()
                .teamId(request.teamId())
                .name(request.name())
                .description(request.description())
                .build();

        Project createdProject = projectService.createProject(projectToCreate);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectResponse.from(createdProject));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update project", description = "Updates mutable fields of an existing project")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Project updated"),
            @ApiResponse(responseCode = "404", description = "Project not found", content = @Content)
    })
    public ProjectResponse updateProject(@PathVariable UUID id, @Valid @RequestBody UpdateProjectRequest request) {
        Project projectToUpdate = Project.builder()
                .name(request.name())
                .description(request.description())
                .build();

        return ProjectResponse.from(projectService.updateProject(id, projectToUpdate));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete project", description = "Deletes a project by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Project deleted", content = @Content),
            @ApiResponse(responseCode = "404", description = "Project not found", content = @Content),
            @ApiResponse(responseCode = "409", description = "Project cannot be deleted because of team constraints",
                    content = @Content(schema = @Schema(implementation = String.class)))
    })
    public ResponseEntity<Void> deleteProject(@PathVariable UUID id) {
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }
}
