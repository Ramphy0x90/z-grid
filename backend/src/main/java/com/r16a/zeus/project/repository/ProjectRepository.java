package com.r16a.zeus.project.repository;

import java.util.UUID;
import java.util.List;

import com.r16a.zeus.project.Project;
import org.springframework.data.repository.CrudRepository;

public interface ProjectRepository extends CrudRepository<Project, UUID> {
    boolean existsByTeamId(UUID teamId);
    long countByTeamId(UUID teamId);
    List<Project> findAllByTeamId(UUID teamId);
}
