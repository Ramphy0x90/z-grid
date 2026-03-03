from py_engine.core.exceptions import EngineExecutionError


class HostingCapacityEngine:
    simulation_type = "HOSTING_CAPACITY"
    engine_key = "remote-python-hosting-capacity-v1"
    engine_version = "v1"

    def execute(self, *_args, **_kwargs):
        raise EngineExecutionError("Hosting capacity engine is not implemented yet.")
