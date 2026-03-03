from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic_settings import BaseSettings


class ServiceConfig(BaseSettings):
    model_config = ConfigDict(extra="ignore")

    app_name: str = Field(default="py-engine")
    app_version: str = Field(default="0.1.0")
    default_powerflow_engine_key: str = Field(default="remote-python-powerflow-v1")
    default_powerflow_engine_version: str = Field(default="v1")


class SolverDefaults(BaseModel):
    max_iterations: int = 30
    tolerance: float = 1e-6
    min_voltage_pu: float = 0.5
    max_voltage_pu: float = 1.5
