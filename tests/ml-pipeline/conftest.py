"""
conftest.py — Shared test fixtures for ML Pipeline tests.

Place in: backend/ml-pipeline/tests/conftest.py

Sets up an ephemeral Postgres connection and initializes the schema
required by the ML pipeline. Uses the same env vars as
docker-compose.test.yml.

Run: pytest tests/ -v --tb=short
"""
import os
import pytest
import psycopg
from sqlalchemy import create_engine, text

# Point to the ephemeral test database (set by docker-compose.test.yml)
os.environ.setdefault("ML_DB_USER", "testuser")
os.environ.setdefault("ML_DB_PASSWORD", "testpass")
os.environ.setdefault("ML_DB_HOST", "test-postgres-ml")
os.environ.setdefault("ML_DB_PORT", "5432")
os.environ.setdefault("ML_DB_NAME", "segmentationdb_test")

# Import AFTER env vars are set
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from app import app as flask_app
from db_config import get_sqlalchemy_url, get_psycopg_dsn


@pytest.fixture(scope="session")
def db_engine():
    """Create a SQLAlchemy engine for the test database."""
    engine = create_engine(get_sqlalchemy_url())
    return engine


@pytest.fixture(scope="session", autouse=True)
def init_schema(db_engine):
    """Initialize the database schema before any tests run."""
    with db_engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS test (
                id serial PRIMARY KEY,
                gender text,
                age integer,
                annual_income integer,
                spending_score integer,
                segment integer
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS mlinfo (
                id serial PRIMARY KEY,
                image2 bytea,
                image3 bytea,
                image4 bytea
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS mlinfo_raw (
                id serial PRIMARY KEY,
                customer_id integer,
                pca_component_1 float,
                pca_component_2 float,
                segment integer
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS segment_metadata (
                id serial PRIMARY KEY,
                segment_id integer,
                color text,
                centroid_age float,
                centroid_income float,
                centroid_spending float
            )
        """))
        conn.commit()
    yield
    # Cleanup after all tests
    with db_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS segment_metadata"))
        conn.execute(text("DROP TABLE IF EXISTS mlinfo_raw"))
        conn.execute(text("DROP TABLE IF EXISTS mlinfo"))
        conn.execute(text("DROP TABLE IF EXISTS test"))
        conn.commit()


@pytest.fixture(scope="session")
def app():
    """Create Flask test app."""
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture(scope="session")
def client(app):
    """Create Flask test client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_tables(db_engine):
    """Clean tables before each test for isolation."""
    with db_engine.connect() as conn:
        conn.execute(text("DELETE FROM segment_metadata"))
        conn.execute(text("DELETE FROM mlinfo_raw"))
        conn.execute(text("DELETE FROM mlinfo"))
        conn.execute(text("DELETE FROM test"))
        conn.commit()
    yield


@pytest.fixture
def seed_customers(db_engine):
    """Seed the test table with sample customer data."""
    customers = [
        (1, 'Male',   19, 15, 39, None),
        (2, 'Male',   21, 15, 81, None),
        (3, 'Female', 20, 16, 6,  None),
        (4, 'Female', 23, 16, 77, None),
        (5, 'Female', 31, 17, 40, None),
        (6, 'Female', 22, 17, 76, None),
        (7, 'Female', 35, 18, 6,  None),
        (8, 'Female', 23, 18, 94, None),
        (9, 'Male',   64, 19, 3,  None),
        (10,'Female', 30, 19, 72, None),
    ]
    with db_engine.connect() as conn:
        for c in customers:
            conn.execute(text(
                "INSERT INTO test (id, gender, age, annual_income, spending_score) "
                "VALUES (:id, :gender, :age, :income, :score)"
            ), {"id": c[0], "gender": c[1], "age": c[2], "income": c[3], "score": c[4]})
        conn.commit()
    return customers
