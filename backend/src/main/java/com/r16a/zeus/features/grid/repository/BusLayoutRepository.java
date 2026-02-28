package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.BusLayout;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface BusLayoutRepository extends CrudRepository<BusLayout, UUID> {
    List<BusLayout> findByGridId(UUID gridId);
    void deleteByGridId(UUID gridId);
}
