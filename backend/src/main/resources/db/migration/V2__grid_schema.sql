CREATE TABLE grids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    nominal_voltage_kv DOUBLE PRECISION,
    bus_type VARCHAR(16) NOT NULL DEFAULT 'PQ',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT buses_type_check CHECK (bus_type IN ('PQ', 'PV', 'SLACK'))
);

CREATE TABLE lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    from_bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    to_bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    name VARCHAR(255),
    resistance_pu DOUBLE PRECISION,
    reactance_pu DOUBLE PRECISION,
    susceptance_pu DOUBLE PRECISION,
    rating_mva DOUBLE PRECISION,
    length_km DOUBLE PRECISION,
    from_switch_closed BOOLEAN NOT NULL DEFAULT TRUE,
    to_switch_closed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transformers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    from_bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    to_bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    name VARCHAR(255),
    resistance_pu DOUBLE PRECISION,
    reactance_pu DOUBLE PRECISION,
    rating_mva DOUBLE PRECISION,
    tap_ratio DOUBLE PRECISION DEFAULT 1.0,
    phase_shift_deg DOUBLE PRECISION DEFAULT 0.0,
    from_switch_closed BOOLEAN NOT NULL DEFAULT TRUE,
    to_switch_closed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    name VARCHAR(255),
    active_power_mw DOUBLE PRECISION,
    reactive_power_mvar DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    name VARCHAR(255),
    active_power_mw DOUBLE PRECISION,
    reactive_power_mvar DOUBLE PRECISION,
    voltage_pu DOUBLE PRECISION DEFAULT 1.0,
    min_mw DOUBLE PRECISION,
    max_mw DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grids_project_id ON grids(project_id);
CREATE INDEX idx_buses_grid_id ON buses(grid_id);
CREATE INDEX idx_lines_grid_id ON lines(grid_id);
CREATE INDEX idx_lines_from_bus_id ON lines(from_bus_id);
CREATE INDEX idx_lines_to_bus_id ON lines(to_bus_id);
CREATE INDEX idx_transformers_grid_id ON transformers(grid_id);
CREATE INDEX idx_transformers_from_bus_id ON transformers(from_bus_id);
CREATE INDEX idx_transformers_to_bus_id ON transformers(to_bus_id);
CREATE INDEX idx_loads_bus_id ON loads(bus_id);
CREATE INDEX idx_generators_bus_id ON generators(bus_id);
