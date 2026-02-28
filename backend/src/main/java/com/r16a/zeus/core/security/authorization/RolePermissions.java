package com.r16a.zeus.core.security.authorization;

import lombok.NoArgsConstructor;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@NoArgsConstructor
public final class RolePermissions {
    private static final Map<Role, Set<Permission>> PERMISSIONS_BY_ROLE = buildPermissionsByRole();

    public static Set<Permission> permissionsFor(Role role) {
        return PERMISSIONS_BY_ROLE.getOrDefault(role, Set.of());
    }

    public static boolean hasPermission(Role role, Permission permission) {
        return permissionsFor(role).contains(permission);
    }

    private static Map<Role, Set<Permission>> buildPermissionsByRole() {
        EnumMap<Role, Set<Permission>> map = new EnumMap<>(Role.class);

        map.put(Role.SUPER_ADMIN, EnumSet.allOf(Permission.class));

        map.put(Role.ADMIN, EnumSet.of(
                Permission.RUN_SIMULATION,
                Permission.MANAGE_PROJECT,
                Permission.MANAGE_TEAM,
                Permission.VIEW_PROJECT
        ));

        map.put(Role.USER, EnumSet.of(
                Permission.RUN_SIMULATION,
                Permission.VIEW_PROJECT
        ));

        map.put(Role.GUEST, EnumSet.of(Permission.VIEW_PROJECT));

        return Map.copyOf(map);
    }
}
