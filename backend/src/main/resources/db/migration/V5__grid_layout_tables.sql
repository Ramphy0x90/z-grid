CREATE TABLE bus_layouts (
    bus_id UUID PRIMARY KEY REFERENCES buses(id) ON DELETE CASCADE,
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    schematic_x DOUBLE PRECISION,
    schematic_y DOUBLE PRECISION
);

CREATE TABLE edge_layouts (
    edge_id UUID PRIMARY KEY,
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    map_midpoint_x DOUBLE PRECISION,
    map_midpoint_y DOUBLE PRECISION,
    schematic_midpoint_x DOUBLE PRECISION,
    schematic_midpoint_y DOUBLE PRECISION
);

CREATE INDEX idx_bus_layouts_grid_id ON bus_layouts(grid_id);
CREATE INDEX idx_edge_layouts_grid_id ON edge_layouts(grid_id);
