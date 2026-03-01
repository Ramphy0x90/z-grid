package com.r16a.zeus.features.simulation.controller;

import com.r16a.zeus.features.simulation.application.SimulationFacade;
import com.r16a.zeus.features.simulation.dto.SimulationRunStatusResponse;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunRequest;
import com.r16a.zeus.features.simulation.dto.StartSimulationRunResponse;
import com.r16a.zeus.features.simulation.exception.SimulationApiDisabledException;
import com.r16a.zeus.features.simulation.model.SimulationType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/grid/{gridId}/simulations/runs")
@RequiredArgsConstructor
@Tag(name = "Simulation", description = "Asynchronous simulation run endpoints")
public class SimulationController {
    private final SimulationFacade simulationFacade;
    @Value("${simulation.v2.enabled:true}")
    private boolean simulationV2Enabled;

    @PostMapping
    @Operation(summary = "Start simulation run", description = "Queues a new asynchronous simulation run.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Run accepted"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public ResponseEntity<StartSimulationRunResponse> startRun(
            @PathVariable UUID gridId,
            @RequestBody(required = false) StartSimulationRunRequest request
    ) {
        assertV2Enabled();
        StartSimulationRunResponse response = simulationFacade.startRun(gridId, request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/{runId}")
    @Operation(summary = "Get run status", description = "Returns status and result payload for one run.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Run status returned"),
            @ApiResponse(responseCode = "404", description = "Grid or run not found", content = @Content)
    })
    public SimulationRunStatusResponse getRun(
            @PathVariable UUID gridId,
            @PathVariable UUID runId
    ) {
        assertV2Enabled();
        return simulationFacade.getRun(gridId, runId);
    }

    @GetMapping
    @Operation(summary = "List runs", description = "Returns latest asynchronous runs for a grid and simulation type.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Runs listed"),
            @ApiResponse(responseCode = "404", description = "Grid not found", content = @Content)
    })
    public List<SimulationRunStatusResponse> listRuns(
            @PathVariable UUID gridId,
            @RequestParam(defaultValue = "POWER_FLOW") SimulationType simulationType
    ) {
        assertV2Enabled();
        return simulationFacade.listRuns(gridId, simulationType);
    }

    private void assertV2Enabled() {
        if (!simulationV2Enabled) {
            throw new SimulationApiDisabledException("Simulation v2 API is disabled.");
        }
    }
}
