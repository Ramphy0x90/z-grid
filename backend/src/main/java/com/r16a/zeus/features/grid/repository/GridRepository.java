package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Grid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.CrudRepository;

public interface GridRepository extends CrudRepository<Grid, UUID> {
    List<Grid> findByProjectId(UUID projectId);
    boolean existsByProjectIdAndName(UUID projectId, String name);
}
