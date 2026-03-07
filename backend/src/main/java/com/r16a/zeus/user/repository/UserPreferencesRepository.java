package com.r16a.zeus.user.repository;

import com.r16a.zeus.user.UserPreferences;
import org.springframework.data.repository.CrudRepository;

import java.util.UUID;

public interface UserPreferencesRepository extends CrudRepository<UserPreferences, UUID> {
}
