UPDATE simulation_runs
SET solver = COALESCE(solver, engine_key, 'local-java-ac-newton-raphson')
WHERE solver IS NULL;

ALTER TABLE simulation_runs
    ALTER COLUMN solver DROP NOT NULL;
