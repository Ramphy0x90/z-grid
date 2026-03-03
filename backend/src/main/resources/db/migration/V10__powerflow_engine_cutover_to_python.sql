UPDATE simulation_runs
SET engine_key = 'remote-python-powerflow-v1'
WHERE simulation_type = 'POWER_FLOW'
  AND engine_key = 'local-java-ac-newton-raphson';

UPDATE simulation_runs
SET solver = 'remote-python-powerflow-v1'
WHERE solver = 'local-java-ac-newton-raphson';
