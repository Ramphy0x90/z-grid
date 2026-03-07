package com.r16a.zeus.features.engine.remote;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RemotePythonHostingCapacityEngineAdapterTest {
    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void executeReturnsSummaryAndDataFor200Response() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.setExecutor(Executors.newSingleThreadExecutor());
        server.createContext("/api/v1/engine/execute", (exchange) -> {
            String payload = """
                    {"summary":{"totalCandidateBuses":2},"data":{"country":"DE","busResults":[]}}
                    """;
            exchange.sendResponseHeaders(200, payload.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        RemotePythonHostingCapacityEngineAdapter adapter = new RemotePythonHostingCapacityEngineAdapter(
                new ObjectMapper(),
                baseUrl,
                "/api/v1/engine/execute",
                10_000,
                0,
                0
        );
        ObjectMapper mapper = new ObjectMapper();
        EngineExecutionRequest request = new EngineExecutionRequest(
                mapper.createObjectNode(),
                mapper.createObjectNode()
        );

        var result = adapter.execute(request);
        assertEquals(2, result.summary().path("totalCandidateBuses").asInt());
        assertEquals("DE", result.data().path("country").asText());
    }

    @Test
    void executeMapsValidationStatusToValidationFailureCode() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.setExecutor(Executors.newSingleThreadExecutor());
        server.createContext("/api/v1/engine/execute", (exchange) -> {
            String payload = """
                    {"errorCode":"VALIDATION","message":"Invalid hosting-capacity input"}
                    """;
            exchange.sendResponseHeaders(422, payload.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        RemotePythonHostingCapacityEngineAdapter adapter = new RemotePythonHostingCapacityEngineAdapter(
                new ObjectMapper(),
                baseUrl,
                "/api/v1/engine/execute",
                10_000,
                0,
                0
        );
        ObjectMapper mapper = new ObjectMapper();
        EngineExecutionRequest request = new EngineExecutionRequest(
                mapper.createObjectNode(),
                mapper.createObjectNode()
        );

        SimulationExecutionException exception = assertThrows(
                SimulationExecutionException.class,
                () -> adapter.execute(request)
        );
        assertEquals(SimulationFailureCode.VALIDATION, exception.getFailureCode());
    }
}
