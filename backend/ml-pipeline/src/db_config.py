"""
Centralized database configuration for the ML Pipeline.

Reads credentials from environment variables (set in docker-compose)
instead of hardcoding them. Falls back to legacy defaults for local
development only — production should always set env vars.
"""
import os
import psycopg as pg
from sqlalchemy import create_engine


# ---------------------------------------------------------------------------
# Read DB config from environment (set by docker-compose-app.yml)
# ---------------------------------------------------------------------------
ML_DB_USER = os.getenv('ML_DB_USER', 'segmentmaster')
ML_DB_PASSWORD = os.getenv('ML_DB_PASSWORD', 'segment')
ML_DB_HOST = os.getenv('ML_DB_HOST', os.getenv('DOCKER_HOST_IP', 'localhost'))
ML_DB_PORT = os.getenv('ML_DB_PORT', '5432')
ML_DB_NAME = os.getenv('ML_DB_NAME', 'segmentationdb')


def get_psycopg_dsn() -> str:
    """Return a psycopg connection string built from env vars."""
    return (
        f"dbname='{ML_DB_NAME}' "
        f"user='{ML_DB_USER}' "
        f"host='{ML_DB_HOST}' "
        f"port='{ML_DB_PORT}' "
        f"password='{ML_DB_PASSWORD}'"
    )


def get_sqlalchemy_url() -> str:
    """Return a SQLAlchemy connection URL built from env vars."""
    return (
        f"postgresql+psycopg://{ML_DB_USER}:{ML_DB_PASSWORD}"
        f"@{ML_DB_HOST}:{ML_DB_PORT}/{ML_DB_NAME}"
    )


def get_postgres_uri() -> str:
    """Return a postgres:// URI built from env vars (for psycopg.connect)."""
    return (
        f"postgres://{ML_DB_USER}:{ML_DB_PASSWORD}"
        f"@{ML_DB_HOST}:{ML_DB_PORT}/{ML_DB_NAME}"
    )


def get_db_connection():
    """Create a psycopg connection to the segmentation database."""
    return pg.connect(get_psycopg_dsn())


def get_sqlalchemy_connection():
    """Create a SQLAlchemy connection to the segmentation database."""
    engine = create_engine(get_sqlalchemy_url())
    return engine.connect()


def get_sqlalchemy_engine():
    """Create a SQLAlchemy engine for the segmentation database."""
    return create_engine(get_sqlalchemy_url())