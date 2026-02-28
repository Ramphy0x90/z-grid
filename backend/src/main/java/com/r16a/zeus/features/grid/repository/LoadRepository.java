package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Load;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface LoadRepository extends CrudRepository<Load, UUID> {
    List<Load> findByBusId(UUID busId);
}
