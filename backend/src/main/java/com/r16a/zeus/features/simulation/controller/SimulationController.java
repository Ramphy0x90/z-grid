package com.r16a.zeus.features.simulation.controller;

import com.r16a.zeus.features.simulation.dto.PowerFlowRunStatusResponse;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunRequest;
import com.r16a.zeus.features.simulation.dto.StartPowerFlowRunResponse;
import com.r16a.zeus.features.simulation.service.PowerFlowSimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/grid/{gridId}/power-flow/runs")
@RequiredArgsConstructor
@Tag(name = "Simulation", description = "Power flow simulation endpoints")
public class SimulationController {
    private final PowerFlowSimulationService powerFlowSimulationService;

    @PostMapping
    @Operation(summary = "Start power flow run", description = "Queues a new asynchronous AC power flow run.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Run accepted"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public ResponseEntity<StartPowerFlowRunResponse> startRun(
            @PathVariable UUID gridId,
            @RequestBody(required = false) StartPowerFlowRunRequest request
    ) {
        StartPowerFlowRunResponse response = powerFlowSimulationService.startRun(gridId, request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/{runId}")
    @Operation(summary = "Get run status", description = "Returns status and results for one power flow run.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Run status returned"),
            @ApiResponse(responseCode = "404", description = "Grid or run not found", content = @Content)
    })
    public PowerFlowRunStatusResponse getRun(
            @PathVariable UUID gridId,
            @PathVariable UUID runId
    ) {
        return powerFlowSimulationService.getRun(gridId, runId);
    }

    @GetMapping
    @Operation(summary = "List runs", description = "Returns latest asynchronous power flow runs for a grid.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Runs listed"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public List<PowerFlowRunStatusResponse> listRuns(@PathVariable UUID gridId) {
        return powerFlowSimulationService.listRuns(gridId);
    }
}
