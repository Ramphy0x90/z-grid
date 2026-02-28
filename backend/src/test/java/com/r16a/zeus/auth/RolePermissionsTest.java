package com.r16a.zeus.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.r16a.zeus.core.security.authorization.Permission;
import com.r16a.zeus.core.security.authorization.Role;
import com.r16a.zeus.core.security.authorization.RolePermissions;
import org.junit.jupiter.api.Test;

class RolePermissionsTest {
    @Test
    void superAdminHasAllPermissions() {
        for (Permission permission : Permission.values()) {
            assertTrue(RolePermissions.hasPermission(Role.SUPER_ADMIN, permission));
        }
    }

    @Test
    void guestCannotRunSimulation() {
        assertFalse(RolePermissions.hasPermission(Role.GUEST, Permission.RUN_SIMULATION));
        assertTrue(RolePermissions.hasPermission(Role.GUEST, Permission.VIEW_PROJECT));
    }
}
