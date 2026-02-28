package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Generator;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface GeneratorRepository extends CrudRepository<Generator, UUID> {
    List<Generator> findByBusId(UUID busId);
    List<Generator> findByBusIdIn(List<UUID> busIds);
}
