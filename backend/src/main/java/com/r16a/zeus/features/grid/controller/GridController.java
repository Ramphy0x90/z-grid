package com.r16a.zeus.features.grid.controller;

import com.r16a.zeus.features.grid.dto.CreateGridRequest;
import com.r16a.zeus.features.grid.dto.GridResponse;
import com.r16a.zeus.features.grid.dto.UpdateGridRequest;
import com.r16a.zeus.features.grid.service.GridService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
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
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/grid")
@RequiredArgsConstructor
@Tag(name = "Grid", description = "Grid metadata and dataset endpoints")
public class GridController {
    private final GridService gridService;

    @GetMapping("/project/{projectId}")
    @Operation(summary = "Get grids by project", description = "Fetches all grids associated with one project")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Grids retrieved"),
            @ApiResponse(responseCode = "404", description = "Project not found", content = @Content)
    })
    public List<GridResponse> getGridsByProject(@PathVariable UUID projectId) {
        return gridService.getGridsByProject(projectId);
    }

    @PostMapping
    @Operation(summary = "Create grid", description = "Creates one grid with an empty dataset")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Grid created"),
            @ApiResponse(responseCode = "404", description = "Project not found", content = @Content)
    })
    public ResponseEntity<GridResponse> createGrid(@Valid @RequestBody CreateGridRequest request) {
        GridResponse created = gridService.createGrid(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{gridId}")
    @Operation(summary = "Update grid metadata", description = "Updates mutable metadata fields of one grid")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Grid updated"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public GridResponse updateGrid(@PathVariable UUID gridId, @Valid @RequestBody UpdateGridRequest request) {
        return gridService.updateGrid(gridId, request);
    }

    @DeleteMapping("/{gridId}")
    @Operation(summary = "Delete grid", description = "Deletes one grid and its dataset")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Grid deleted", content = @Content),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public ResponseEntity<Void> deleteGrid(@PathVariable UUID gridId) {
        gridService.deleteGrid(gridId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{gridId}/duplicate")
    @Operation(summary = "Duplicate grid", description = "Duplicates grid metadata and full dataset")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Grid duplicated"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public ResponseEntity<GridResponse> duplicateGrid(@PathVariable UUID gridId) {
        GridResponse duplicated = gridService.duplicateGrid(gridId);
        return ResponseEntity.status(HttpStatus.CREATED).body(duplicated);
    }

    @GetMapping("/{gridId}/dataset")
    @Operation(summary = "Get full grid dataset", description = "Returns the complete grid dataset payload")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Dataset retrieved"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public JsonNode getGridDataset(@PathVariable UUID gridId) {
        return gridService.getGridDataset(gridId);
    }

    @PutMapping("/{gridId}/dataset")
    @Operation(summary = "Replace full grid dataset", description = "Replaces full dataset for one grid")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Dataset saved"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public JsonNode replaceGridDataset(@PathVariable UUID gridId, @RequestBody JsonNode dataset) {
        return gridService.replaceGridDataset(gridId, dataset);
    }
}
