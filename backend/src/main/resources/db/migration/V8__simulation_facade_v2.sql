ALTER TABLE simulation_runs
    ADD COLUMN simulation_type VARCHAR(64),
    ADD COLUMN engine_key VARCHAR(128),
    ADD COLUMN engine_version VARCHAR(64),
    ADD COLUMN idempotency_key VARCHAR(128),
    ADD COLUMN failure_code VARCHAR(64);

UPDATE simulation_runs
SET simulation_type = 'POWER_FLOW',
    engine_key = COALESCE(solver, 'local-java-ac-newton-raphson'),
    engine_version = 'v1'
WHERE simulation_type IS NULL;

ALTER TABLE simulation_runs
    ALTER COLUMN simulation_type SET NOT NULL,
    ALTER COLUMN engine_key SET NOT NULL;

CREATE INDEX idx_simulation_runs_grid_type_created
    ON simulation_runs (grid_id, simulation_type, created_at DESC);

CREATE INDEX idx_simulation_runs_grid_type_status
    ON simulation_runs (grid_id, simulation_type, status);

CREATE INDEX idx_simulation_runs_idempotency
    ON simulation_runs (grid_id, simulation_type, idempotency_key, created_at DESC);

CREATE TABLE simulation_run_results (
    run_id UUID PRIMARY KEY REFERENCES simulation_runs(id) ON DELETE CASCADE,
    simulation_type VARCHAR(64) NOT NULL,
    summary_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO simulation_run_results (run_id, simulation_type, summary_json, result_json, created_at, updated_at)
SELECT
    pfr.run_id,
    'POWER_FLOW',
    json_build_object(
            'totalLoadMw', pfr.total_load_mw,
            'totalGenerationMw', pfr.total_generation_mw,
            'lossesMw', pfr.losses_mw
    )::text,
    pfr.result_json,
    pfr.created_at,
    pfr.updated_at
FROM power_flow_results pfr
ON CONFLICT (run_id) DO NOTHING;

DROP TABLE power_flow_results;
