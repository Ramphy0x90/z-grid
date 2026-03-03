from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse

from py_engine.api.routes import router
from py_engine.core.exceptions import EngineExecutionError
from py_engine.core.exceptions import EngineTimeoutError
from py_engine.core.exceptions import EngineValidationError
from py_engine.core.logging import configure_logging

configure_logging()

app = FastAPI(title="py-engine", version="0.1.0")
app.include_router(router)


@app.exception_handler(EngineValidationError)
async def handle_validation_error(_request: Request, exc: EngineValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"errorCode": "VALIDATION", "message": str(exc)})


@app.exception_handler(EngineTimeoutError)
async def handle_timeout_error(_request: Request, exc: EngineTimeoutError) -> JSONResponse:
    return JSONResponse(status_code=504, content={"errorCode": "ENGINE_TIMEOUT", "message": str(exc)})


@app.exception_handler(EngineExecutionError)
async def handle_execution_error(_request: Request, exc: EngineExecutionError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"errorCode": "ENGINE_ERROR", "message": str(exc)})
