from typing import Any

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class EngineExecuteRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    simulationType: str = Field(default="POWER_FLOW")
    engineKey: str | None = None
    engineVersion: str | None = None
    gridDataset: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class EngineExecuteResponse(BaseModel):
    summary: dict[str, Any]
    data: dict[str, Any]
    engineKey: str
    engineVersion: str
