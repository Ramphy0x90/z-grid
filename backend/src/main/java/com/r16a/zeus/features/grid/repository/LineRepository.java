package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Line;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface LineRepository extends CrudRepository<Line, UUID> {
    List<Line> findByGridId(UUID gridId);
}
