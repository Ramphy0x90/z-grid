CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    map_style VARCHAR(32) NOT NULL DEFAULT 'cartoDark',
    default_power_quality_country VARCHAR(2) NOT NULL DEFAULT 'DE',
    default_hosting_capacity_country VARCHAR(2) NOT NULL DEFAULT 'DE',
    default_map_view VARCHAR(16) NOT NULL DEFAULT 'map',
    voltage_level_colors_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_preferences_map_style_check
        CHECK (map_style IN ('cartoDark', 'cartoLight', 'osmStandard', 'openTopo')),
    CONSTRAINT user_preferences_map_view_check
        CHECK (default_map_view IN ('map', 'schematic')),
    CONSTRAINT user_preferences_power_quality_country_check
        CHECK (default_power_quality_country IN ('ES', 'CH', 'DE', 'FR', 'IT', 'GB')),
    CONSTRAINT user_preferences_hosting_capacity_country_check
        CHECK (default_hosting_capacity_country IN ('ES', 'CH', 'DE', 'FR', 'IT', 'GB')),
    CONSTRAINT user_preferences_voltage_level_colors_json_type_check
        CHECK (jsonb_typeof(voltage_level_colors_json) = 'object')
);
