package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Bus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.CrudRepository;

public interface BusRepository extends CrudRepository<Bus, UUID> {
    List<Bus> findByGridId(UUID gridId);
    long countByGridId(UUID gridId);
    void deleteByGridId(UUID gridId);
}
