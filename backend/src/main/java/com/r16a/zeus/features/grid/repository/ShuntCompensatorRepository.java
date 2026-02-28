package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.ShuntCompensator;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface ShuntCompensatorRepository extends CrudRepository<ShuntCompensator, UUID> {
    List<ShuntCompensator> findByBusId(UUID busId);
    List<ShuntCompensator> findByBusIdIn(List<UUID> busIds);
}
