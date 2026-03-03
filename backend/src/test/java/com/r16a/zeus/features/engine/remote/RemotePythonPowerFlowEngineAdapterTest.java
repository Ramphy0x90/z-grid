package com.r16a.zeus.features.engine.remote;

import com.r16a.zeus.features.engine.EngineExecutionRequest;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RemotePythonPowerFlowEngineAdapterTest {
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
                    {"summary":{"totalLoadMw":10.0,"totalGenerationMw":11.0,"lossesMw":1.0},"data":{"converged":true}}
                    """;
            exchange.sendResponseHeaders(200, payload.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        RemotePythonPowerFlowEngineAdapter adapter = new RemotePythonPowerFlowEngineAdapter(
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
        assertEquals(10.0, result.summary().path("totalLoadMw").asDouble());
        assertEquals(true, result.data().path("converged").asBoolean());
    }

    @Test
    void executeMapsValidationStatusToValidationFailureCode() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.setExecutor(Executors.newSingleThreadExecutor());
        server.createContext("/api/v1/engine/execute", (exchange) -> {
            String payload = """
                    {"errorCode":"VALIDATION","message":"Invalid powerflow input"}
                    """;
            exchange.sendResponseHeaders(422, payload.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        RemotePythonPowerFlowEngineAdapter adapter = new RemotePythonPowerFlowEngineAdapter(
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

    @Test
    void executeMapsRequestTimeoutToEngineTimeoutFailureCode() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.setExecutor(Executors.newSingleThreadExecutor());
        server.createContext("/api/v1/engine/execute", (exchange) -> {
            try {
                Thread.sleep(250);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            String payload = "{\"summary\":{},\"data\":{}}";
            exchange.sendResponseHeaders(200, payload.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        RemotePythonPowerFlowEngineAdapter adapter = new RemotePythonPowerFlowEngineAdapter(
                new ObjectMapper(),
                baseUrl,
                "/api/v1/engine/execute",
                100,
                0,
                0
        );
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode dataset = mapper.createObjectNode();
        EngineExecutionRequest request = new EngineExecutionRequest(dataset, mapper.createObjectNode());

        SimulationExecutionException exception = assertThrows(
                SimulationExecutionException.class,
                () -> adapter.execute(request)
        );
        assertEquals(SimulationFailureCode.ENGINE_TIMEOUT, exception.getFailureCode());
    }
}
