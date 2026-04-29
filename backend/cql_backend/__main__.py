"""Entry point — ``python -m cql_backend`` or ``uvicorn cql_backend.app:app``."""
from __future__ import annotations

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "cql_backend.app:app",
        host=os.environ.get("CQL_BACKEND_HOST", "0.0.0.0"),
        port=int(os.environ.get("CQL_BACKEND_PORT", "8101")),
        reload=os.environ.get("CQL_BACKEND_RELOAD", "false").lower() in {"1", "true", "yes"},
        log_level=os.environ.get("CQL_BACKEND_LOG_LEVEL", "info"),
    )


if __name__ == "__main__":
    main()
