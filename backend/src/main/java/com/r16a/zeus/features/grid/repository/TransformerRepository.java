package com.r16a.zeus.features.grid.repository;

import com.r16a.zeus.features.grid.model.Transformer;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

public interface TransformerRepository extends CrudRepository<Transformer, UUID> {
    List<Transformer> findByGridId(UUID gridId);
}
