FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY cql_backend ./cql_backend

RUN pip install --upgrade pip && pip install .

EXPOSE 8101

ENV CQL_BACKEND_HOST=0.0.0.0 \
    CQL_BACKEND_PORT=8101

CMD ["python", "-m", "cql_backend"]
