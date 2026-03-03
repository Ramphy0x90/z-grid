from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from fastapi import Depends

from py_engine.api.schemas import EngineExecuteRequest
from py_engine.api.schemas import EngineExecuteResponse
from py_engine.core.config import ServiceConfig
from py_engine.engines.registry import EngineRegistry

logger = logging.getLogger(__name__)

router = APIRouter()


def get_config() -> ServiceConfig:
    return ServiceConfig()


def get_registry() -> EngineRegistry:
    return EngineRegistry()


@router.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/v1/engine/execute", response_model=EngineExecuteResponse)
def execute_engine(
    request: EngineExecuteRequest,
    config: ServiceConfig = Depends(get_config),
    registry: EngineRegistry = Depends(get_registry),
) -> EngineExecuteResponse:
    simulation_type = request.simulationType
    engine_key = request.engineKey or config.default_powerflow_engine_key
    started = time.perf_counter()
    engine = registry.resolve(simulation_type, engine_key)
    summary, data = engine.execute(request.gridDataset, request.options)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    logger.info(
        "engine_execute_success simulation_type=%s engine_key=%s elapsed_ms=%.3f",
        simulation_type,
        engine_key,
        elapsed_ms,
    )
    return EngineExecuteResponse(
        summary=summary,
        data=data,
        engineKey=engine_key,
        engineVersion=request.engineVersion or engine.engine_version,
    )
