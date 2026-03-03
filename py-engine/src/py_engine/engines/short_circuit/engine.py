from py_engine.core.exceptions import EngineExecutionError


class ShortCircuitEngine:
    simulation_type = "SHORT_CIRCUIT"
    engine_key = "remote-python-short-circuit-v1"
    engine_version = "v1"

    def execute(self, *_args, **_kwargs):
        raise EngineExecutionError("Short circuit engine is not implemented yet.")
