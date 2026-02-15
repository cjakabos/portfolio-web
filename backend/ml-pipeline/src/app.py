"""
Author: Csaba Jakabos
Date: December, 2023
This script used to create the app Flask API
"""
import os
import re
import subprocess
import logging
import sys
import pandas as pd
import psycopg as pg
import base64
import json
import numpy as np

from flask import Flask, jsonify, request, make_response
from sqlalchemy import create_engine
from werkzeug.middleware.dispatcher import DispatcherMiddleware

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up variables for use in our script
app = Flask(__name__)
default_prefix = '/mlops-segmentation'
host_ip = os.getenv('DOCKER_HOST_IP', 'localhost')

app.config['APPLICATION_ROOT'] = default_prefix

# ===========================================================================
# OpenTelemetry — initialize tracing (no-op if OTEL_ENABLED != "true")
# ===========================================================================
from otel_setup import init_telemetry
init_telemetry(app)

# Spectral_r colormap colors for 5 clusters - matches plt.get_cmap("Spectral_r", 5)
SPECTRAL_R_COLORS = {
    0: "#5e4fa2",  # Dark purple
    1: "#3288bd",  # Blue
    2: "#66c2a5",  # Teal/Green
    3: "#fdae61",  # Orange
    4: "#9e0142"   # Dark red/maroon
}

# =========================================================================
# Input Validation
# =========================================================================

# Valid range for sampleSize parameter
SAMPLE_SIZE_MIN = -2
SAMPLE_SIZE_MAX = 10000


def validate_sample_size(value) -> int:
    """
    Validate and sanitize the sampleSize parameter.
    Returns a safe integer value or raises ValueError.
    """
    if value is None:
        raise ValueError("sampleSize is required")

    try:
        sample_size = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"sampleSize must be an integer, got: {type(value).__name__}")

    if sample_size < SAMPLE_SIZE_MIN or sample_size > SAMPLE_SIZE_MAX:
        raise ValueError(
            f"sampleSize must be between {SAMPLE_SIZE_MIN} and {SAMPLE_SIZE_MAX}, got: {sample_size}"
        )

    return sample_size


def run_script(script_name: str, args: list = None):
    """
    Safely run a Python script as a subprocess.
    Uses subprocess.run() with explicit argument list to prevent command injection.
    """
    cmd = [sys.executable, script_name]
    if args:
        cmd.extend([str(a) for a in args])

    logger.info(f"Running subprocess: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            check=False
        )
        if result.returncode != 0:
            logger.error(f"Script {script_name} failed with return code {result.returncode}")
            logger.error(f"stderr: {result.stderr}")
            return False
        if result.stdout:
            logger.info(f"Script {script_name} output: {result.stdout[:500]}")
        return True
    except subprocess.TimeoutExpired:
        logger.error(f"Script {script_name} timed out after 300 seconds")
        return False
    except Exception as e:
        logger.error(f"Failed to run script {script_name}: {e}")
        return False


# =========================================================================
# Database Connection Helper
# =========================================================================

def get_db_connection():
    """Create a psycopg connection to the segmentation database."""
    return pg.connect(
        f"dbname='segmentationdb' user='segmentmaster' host='{host_ip}' port='5434' password='segment'"
    )


def get_sqlalchemy_connection():
    """Create a SQLAlchemy connection to the segmentation database."""
    conn_string = f"postgresql+psycopg://segmentmaster:segment@{host_ip}:5434/segmentationdb"
    db = create_engine(conn_string)
    return db.connect()


# =========================================================================
# Health Check Endpoint
# =========================================================================

@app.route('/health')
def health():
    """Health check endpoint for Docker and load balancer probes."""
    health_status = {"status": "healthy", "service": "ml-pipeline"}
    try:
        conn = get_db_connection()
        conn.close()
        health_status["database"] = "connected"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = f"unavailable: {str(e)}"
        return jsonify(health_status), 503
    return jsonify(health_status), 200


@app.route('/')
def index():
    return "Hello World"

@app.route('/getSegmentationCustomers', methods=['GET'])
def getSegmentationCustomers(pg=pg):
    connection = get_db_connection()
    try:
        data_df = pd.read_sql('select * from test', connection)
        return data_df.to_json(orient='records')
    finally:
        connection.close()

@app.route('/getMLInfo', methods=['POST'])
def getMLInfo(pg=pg):
    data = request.json

    if data is None:
        return jsonify({"error": "Request body must be JSON"}), 400

    # Validate sampleSize input
    try:
        sample_size = validate_sample_size(data.get("sampleSize"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    '''
    General logic for 1. reinit and 2. resegment and 3. read segment results:
    - if sampleSize is > 0, reinit with default csv or with sampleSize amount of datapoints from csv, also resegment
    - if sampleSize is -1, means new datapoint from UI, do not reinit, but resegment
    - if sampleSize is -2, only read current MLOps info, do not reinit and do not resegment
    '''

    # 1. reinit DB, if needed
    if sample_size > 0:
        if not run_script("init_segmentationdb.py", [sample_size]):
            logger.error("init_segmentationdb.py failed")
            return jsonify({"error": "Database initialization failed"}), 500
    elif sample_size == 0:
        if not run_script("init_segmentationdb.py"):
            logger.error("init_segmentationdb.py failed")
            return jsonify({"error": "Database initialization failed"}), 500

    # 2. resegment DB, if needed
    if sample_size >= -1:
        if not run_script("segmentation_process.py"):
            logger.error("segmentation_process.py failed")
            return jsonify({"error": "Segmentation process failed"}), 500

    # 3. read segment results
    connection = get_db_connection()

    try:
        customers_df = pd.read_sql('select * from test', connection)

        try:
            mlinfo_df = pd.read_sql('select * from mlinfo_raw', connection)
        except Exception as e:
            mlinfo_df = pd.DataFrame(columns=['customer_id', 'pca_component_1', 'pca_component_2', 'segment'])

        segment_metadata = _get_segment_metadata(connection)

        spending_data = customers_df["spending_score"].tolist()

        response_data = {
            "spending_histogram": {
                "data": spending_data,
                "bins": 10,
                "title": "spending_score"
            },
            "pairplot_data": {
                "age": customers_df["age"].tolist(),
                "annual_income": customers_df["annual_income"].tolist(),
                "spending_score": customers_df["spending_score"].tolist(),
                "gender": customers_df["gender"].tolist()
            },
            "cluster_scatter": {
                "pca_component_1": mlinfo_df["pca_component_1"].tolist() if "pca_component_1" in mlinfo_df.columns else [],
                "pca_component_2": mlinfo_df["pca_component_2"].tolist() if "pca_component_2" in mlinfo_df.columns else [],
                "segment": mlinfo_df["segment"].tolist() if "segment" in mlinfo_df.columns else [],
                "customer_id": mlinfo_df["customer_id"].tolist() if "customer_id" in mlinfo_df.columns else [],
                "n_clusters": 5,
                "title": "Domains grouped into 5 clusters"
            },
            "segment_metadata": segment_metadata
        }

        return json.dumps(response_data)
    finally:
        connection.close()


def _get_segment_metadata(connection):
    """Get segment colors and statistics from the database."""
    try:
        segment_meta_df = pd.read_sql('select * from segment_metadata', connection)
        metadata = {}
        for _, row in segment_meta_df.iterrows():
            segment_id = int(row['segment_id'])
            metadata[segment_id] = {
                "color": row['color'],
                "centroid_age": float(row['centroid_age']) if pd.notna(row['centroid_age']) else None,
                "centroid_income": float(row['centroid_income']) if pd.notna(row['centroid_income']) else None,
                "centroid_spending": float(row['centroid_spending']) if pd.notna(row['centroid_spending']) else None
            }
        return metadata
    except Exception as e:
        return {
            0: {"color": "#5e4fa2"},
            1: {"color": "#3288bd"},
            2: {"color": "#66c2a5"},
            3: {"color": "#fdae61"},
            4: {"color": "#9e0142"}
        }


@app.route('/addCustomer', methods=['POST'])
def addCustomer(pg=pg):
    data = request.json

    if data is None or 'fields' not in data:
        return jsonify({"error": "Request body must contain 'fields'"}), 400

    connection = get_sqlalchemy_connection()

    try:
        ingestion = data['fields']
        df = pd.DataFrame([ingestion])
        df.to_sql('test', con=connection, if_exists='append', index=False)
    finally:
        connection.close()

    conn = get_db_connection()
    conn.autocommit = True
    conn.close()

    return jsonify(data['fields'])

app.wsgi_app = DispatcherMiddleware(index, {default_prefix: app.wsgi_app})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8600, debug=True, threaded=True)