package com.r16a.zeus.project.service;

import com.r16a.zeus.project.exception.ProjectExampleNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class ProjectExampleCatalogService {
    private static final Map<String, ProjectExampleCatalogEntry> EXAMPLES_BY_KEY = Map.of(
            "zurich", new ProjectExampleCatalogEntry(
                    "zurich",
                    "Zurich",
                    "project-examples/zurich.json",
                    "Zurich Example Project",
                    "Zurich Metropolitan Grid"
            ),
            "tokyo", new ProjectExampleCatalogEntry(
                    "tokyo",
                    "Tokyo",
                    "project-examples/tokyo.json",
                    "Tokyo Example Project",
                    "Tokyo Urban Grid"
            ),
            "new-delhi", new ProjectExampleCatalogEntry(
                    "new-delhi",
                    "New Delhi",
                    "project-examples/new-delhi.json",
                    "New Delhi Example Project",
                    "New Delhi Transmission Grid"
            ),
            "madrid", new ProjectExampleCatalogEntry(
                    "madrid",
                    "Madrid",
                    "project-examples/madrid.json",
                    "Madrid Example Project",
                    "Madrid Regional Grid"
            )
    );

    private final ObjectMapper objectMapper;

    public ProjectExampleCatalogService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ProjectExampleCatalogEntry getExampleByKeyOrThrow(String exampleKey) {
        String normalizedKey = normalizeKey(exampleKey);
        ProjectExampleCatalogEntry entry = EXAMPLES_BY_KEY.get(normalizedKey);
        if (entry == null) {
            throw new ProjectExampleNotFoundException(
                    "Unsupported example key '" + exampleKey + "'. Supported values: " + String.join(", ", supportedKeys())
            );
        }
        return entry;
    }

    public JsonNode loadDataset(ProjectExampleCatalogEntry entry) {
        ClassPathResource resource = new ClassPathResource(entry.resourcePath());
        try (InputStream stream = resource.getInputStream()) {
            return objectMapper.readTree(stream);
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to load project example dataset for key '" + entry.key() + "'.",
                    exception
            );
        }
    }

    public List<String> supportedKeys() {
        return EXAMPLES_BY_KEY.keySet().stream().sorted().toList();
    }

    private String normalizeKey(String key) {
        return key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
    }

    public record ProjectExampleCatalogEntry(
            String key,
            String cityLabel,
            String resourcePath,
            String defaultProjectName,
            String defaultGridName
    ) {
    }
}
