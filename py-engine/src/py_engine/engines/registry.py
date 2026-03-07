from py_engine.core.exceptions import EngineValidationError
from py_engine.engines.hosting_capacity.engine import HostingCapacityEngine
from py_engine.engines.powerflow.engine import PowerFlowEngine
from py_engine.engines.power_quality.engine import PowerQualityEngine
from py_engine.engines.short_circuit.engine import ShortCircuitEngine


class EngineRegistry:
    def __init__(self) -> None:
        engines = [PowerFlowEngine(), HostingCapacityEngine(), ShortCircuitEngine(), PowerQualityEngine()]
        self._by_key = {
            (engine.simulation_type, engine.engine_key): engine
            for engine in engines
        }

    def resolve(self, simulation_type: str, engine_key: str):
        engine = self._by_key.get((simulation_type, engine_key))
        if engine is None:
            raise EngineValidationError(
                f"No engine implementation for simulationType={simulation_type} engineKey={engine_key}"
            )
        return engine
