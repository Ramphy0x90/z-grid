CREATE TABLE simulation_runs (
    id UUID PRIMARY KEY,
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    solver VARCHAR(64) NOT NULL,
    options_json TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulation_runs_grid_created_at
    ON simulation_runs (grid_id, created_at DESC);

CREATE INDEX idx_simulation_runs_grid_status
    ON simulation_runs (grid_id, status);

CREATE TABLE power_flow_results (
    run_id UUID PRIMARY KEY REFERENCES simulation_runs(id) ON DELETE CASCADE,
    converged BOOLEAN NOT NULL,
    iterations INTEGER NOT NULL,
    total_load_mw DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_generation_mw DOUBLE PRECISION NOT NULL DEFAULT 0,
    losses_mw DOUBLE PRECISION NOT NULL DEFAULT 0,
    result_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
