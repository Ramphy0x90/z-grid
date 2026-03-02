package com.r16a.zeus.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.r16a.zeus.project.exception.ProjectExampleNotFoundException;
import com.r16a.zeus.project.service.ProjectExampleCatalogService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class ProjectExampleCatalogServiceTest {
    private final ProjectExampleCatalogService catalogService = new ProjectExampleCatalogService(new ObjectMapper());

    @Test
    void getExampleByKeyOrThrowResolvesKnownKey() {
        ProjectExampleCatalogService.ProjectExampleCatalogEntry entry = catalogService.getExampleByKeyOrThrow("tokyo");

        assertEquals("tokyo", entry.key());
        assertEquals("Tokyo", entry.cityLabel());
    }

    @Test
    void getExampleByKeyOrThrowRejectsUnknownKey() {
        assertThrows(ProjectExampleNotFoundException.class, () -> catalogService.getExampleByKeyOrThrow("unknown"));
    }

    @Test
    void loadDatasetLoadsJsonFromResources() {
        ProjectExampleCatalogService.ProjectExampleCatalogEntry entry = catalogService.getExampleByKeyOrThrow("madrid");

        JsonNode dataset = catalogService.loadDataset(entry);

        assertTrue(dataset.isObject());
        assertEquals("Madrid Regional Grid", dataset.path("grid").path("name").asText());
    }
}
