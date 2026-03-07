package com.r16a.zeus.features.engine.remote;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.engine.EngineExecutionResult;
import com.r16a.zeus.features.engine.EngineFacade;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class RemotePythonPowerQualityEngineAdapter implements EngineFacade {
    public static final String ENGINE_KEY = "remote-python-power-quality-v1";

    private static final String DEFAULT_ENDPOINT = "/api/v1/engine/execute";
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI endpointUri;
    private final int retryCount;
    private final long retryBackoffMs;
    private final Duration requestTimeout;

    public RemotePythonPowerQualityEngineAdapter(
            ObjectMapper objectMapper,
            @Value("${engine.remote.python.base-url:http://localhost:8090}") String baseUrl,
            @Value("${engine.remote.python.execute-endpoint:/api/v1/engine/execute}") String executeEndpoint,
            @Value("${engine.remote.python.timeout-ms:120000}") long timeoutMs,
            @Value("${engine.remote.python.retry-count:1}") int retryCount,
            @Value("${engine.remote.python.retry-backoff-ms:250}") long retryBackoffMs
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(1000, timeoutMs)))
                .build();
        this.endpointUri = URI.create(normalizeBaseUrl(baseUrl) + normalizeEndpoint(executeEndpoint));
        this.retryCount = Math.max(0, retryCount);
        this.retryBackoffMs = Math.max(0L, retryBackoffMs);
        this.requestTimeout = Duration.ofMillis(Math.max(1000, timeoutMs));
    }

    @Override
    public SimulationType simulationType() {
        return SimulationType.POWER_QUALITY;
    }

    @Override
    public String engineKey() {
        return ENGINE_KEY;
    }

    @Override
    public String engineVersion() {
        return "v1";
    }

    @Override
    public EngineExecutionResult execute(EngineExecutionRequest request) {
        String payload = serializeRequest(request);
        HttpRequest httpRequest = HttpRequest.newBuilder(endpointUri)
                .header("Content-Type", "application/json")
                .timeout(requestTimeout)
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        int attempts = retryCount + 1;
        Exception lastException = null;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
                return mapResponse(response);
            } catch (java.net.http.HttpTimeoutException ex) {
                lastException = ex;
                if (attempt == attempts) {
                    throw new SimulationExecutionException(
                            SimulationFailureCode.ENGINE_TIMEOUT,
                            "Remote Python engine request timed out.",
                            ex
                    );
                }
            } catch (IOException ex) {
                lastException = ex;
                if (attempt == attempts) {
                    throw new SimulationExecutionException(
                            SimulationFailureCode.ENGINE_ERROR,
                            "Remote Python engine call failed due to IO error.",
                            ex
                    );
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new SimulationExecutionException(
                        SimulationFailureCode.SYSTEM_ERROR,
                        "Remote Python engine call interrupted.",
                        ex
                );
            }
            sleepBackoff();
        }

        throw new SimulationExecutionException(
                SimulationFailureCode.ENGINE_ERROR,
                "Remote Python engine call failed.",
                lastException
        );
    }

    private String serializeRequest(EngineExecutionRequest request) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("simulationType", simulationType().name());
        payload.put("engineKey", ENGINE_KEY);
        payload.put("engineVersion", engineVersion());
        payload.set("gridDataset", request.gridDataset() == null ? objectMapper.createObjectNode() : request.gridDataset());
        payload.set("options", request.options() == null ? objectMapper.createObjectNode() : request.options());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            throw new SimulationExecutionException(
                    SimulationFailureCode.SYSTEM_ERROR,
                    "Failed to serialize remote engine request payload.",
                    ex
            );
        }
    }

    private EngineExecutionResult mapResponse(HttpResponse<String> response) {
        int status = response.statusCode();
        String body = response.body();

        JsonNode responseNode;
        try {
            responseNode = (body == null || body.isBlank())
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new SimulationExecutionException(
                    SimulationFailureCode.ENGINE_ERROR,
                    "Remote Python engine returned invalid JSON.",
                    ex
            );
        }

        if (status == 200) {
            JsonNode summary = responseNode.path("summary");
            JsonNode data = responseNode.path("data");
            if (!summary.isObject() || !data.isObject()) {
                throw new SimulationExecutionException(
                        SimulationFailureCode.ENGINE_ERROR,
                        "Remote Python engine response is missing summary/data objects."
                );
            }
            return new EngineExecutionResult(summary, data);
        }

        String remoteMessage = responseNode.path("message").asText("Remote Python engine returned status " + status + ".");
        if (status == 422) {
            throw new SimulationExecutionException(SimulationFailureCode.VALIDATION, remoteMessage);
        }
        if (status == 504) {
            throw new SimulationExecutionException(SimulationFailureCode.ENGINE_TIMEOUT, remoteMessage);
        }
        throw new SimulationExecutionException(SimulationFailureCode.ENGINE_ERROR, remoteMessage);
    }

    private void sleepBackoff() {
        if (retryBackoffMs <= 0) {
            return;
        }
        try {
            Thread.sleep(retryBackoffMs);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new SimulationExecutionException(
                    SimulationFailureCode.SYSTEM_ERROR,
                    "Interrupted while waiting for remote engine retry backoff.",
                    ex
            );
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        String value = (baseUrl == null || baseUrl.isBlank()) ? "http://localhost:8090" : baseUrl.trim();
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    private String normalizeEndpoint(String endpoint) {
        String value = (endpoint == null || endpoint.isBlank()) ? DEFAULT_ENDPOINT : endpoint.trim();
        if (!value.startsWith("/")) {
            return "/" + value;
        }
        return value;
    }
}
