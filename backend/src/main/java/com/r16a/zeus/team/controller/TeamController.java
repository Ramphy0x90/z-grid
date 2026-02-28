package com.r16a.zeus.team.controller;

import com.r16a.zeus.team.Team;
import com.r16a.zeus.team.dto.TeamResponse;
import com.r16a.zeus.team.dto.UpdateTeamRequest;
import com.r16a.zeus.team.service.TeamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/team")
@RequiredArgsConstructor
@Tag(name = "Team", description = "Team management endpoints")
public class TeamController {
    private final TeamService teamService;

    @GetMapping("/{id}")
    @Operation(summary = "Get team by ID", description = "Fetches a single team by its unique ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Team found"),
            @ApiResponse(responseCode = "404", description = "Team not found", content = @Content)
    })
    public TeamResponse getTeamById(@PathVariable UUID id) {
        return TeamResponse.from(teamService.getTeamByIdOrThrow(id));
    }

    @GetMapping
    @Operation(summary = "Get teams", description = "Fetches all teams")
    @ApiResponse(responseCode = "200", description = "Teams retrieved")
    public List<TeamResponse> getTeams() {
        return teamService.getTeams()
                .stream()
                .map(TeamResponse::from)
                .toList();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update team", description = "Updates mutable fields of an existing team")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Team updated"),
            @ApiResponse(responseCode = "404", description = "Team not found", content = @Content)
    })
    public TeamResponse updateTeam(@PathVariable UUID id, @Valid @RequestBody UpdateTeamRequest request) {
        Team teamToUpdate = Team.builder()
                .name(request.name())
                .description(request.description())
                .build();

        return TeamResponse.from(teamService.updateTeam(id, teamToUpdate));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete team", description = "Deletes a team by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Team deleted", content = @Content),
            @ApiResponse(responseCode = "404", description = "Team not found", content = @Content),
            @ApiResponse(responseCode = "409", description = "Team cannot be deleted because of project constraints",
                    content = @Content(schema = @Schema(implementation = String.class)))
    })
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID id) {
        teamService.deleteTeam(id);
        return ResponseEntity.noContent().build();
    }
}
