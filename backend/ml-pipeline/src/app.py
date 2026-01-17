"""
Author: Csaba Jakabos
Date: December, 2023
This script used to create the app Flask API
"""
import os
import re
import subprocess
import pandas as pd
import psycopg as pg
import base64
import json
import numpy as np

from flask import Flask, jsonify, request, make_response
from flask_cors import CORS, cross_origin
from sqlalchemy import create_engine
from werkzeug.middleware.dispatcher import DispatcherMiddleware


# Set up variables for use in our script
app = Flask(__name__)
default_prefix = '/mlops-segmentation'
host_ip = os.getenv('DOCKER_HOST_IP', 'localhost')
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:5001",
    "https://localhost:5001",
    "http://127.0.0.1:5001",
    "https://127.0.0.1:5001",
    "http://localhost:5005",
    "https://localhost:5005",
    "http://127.0.0.1:5005",
    "https://127.0.0.1:5005",
    "http://127.0.0.1:80",
    "https://127.0.0.1:443"
]}})
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['APPLICATION_ROOT'] = default_prefix

# Spectral_r colormap colors for 5 clusters - matches plt.get_cmap("Spectral_r", 5)
SPECTRAL_R_COLORS = {
    0: "#5e4fa2",  # Dark purple
    1: "#3288bd",  # Blue
    2: "#66c2a5",  # Teal/Green
    3: "#fdae61",  # Orange
    4: "#9e0142"   # Dark red/maroon
}


@app.route('/')
@cross_origin()
def index():
    return "Hello World"

@app.route('/getSegmentationCustomers', methods=['GET'])
def getSegmentationCustomers(pg=pg):
    connection = pg.connect(f"dbname='segmentationdb' user='segmentmaster' host='{host_ip}' port='5434' password='segment'")
    data_df = pd.read_sql('select * from test', connection)
    return data_df.to_json(orient='records')

@app.route('/getMLInfo', methods=['POST'])
def getMLInfo(pg=pg):
    data = request.json

    '''
    General logic for 1. reinit and 2. resegment and 3. read segment results:
    - if sampleSize is > 0, reinit with default csv or with sampleSize amount of datapoints from csv, also resegment
    - if sampleSize is -1, means new datapoint from UI, do not reinit, but resegment
    - if sampleSize is -2, only read current MLOps info, do not reinit and do not resegment
    '''

    # 1. reinit DB, if needed
    #if sampleSize is specific to non-zero, sample only that set of database, otherwise run on full DB
    if data.get("sampleSize") > 0:
        os.system("python3 init_segmentationdb.py " + str(data.get("sampleSize")))
    #if sampleSize is 0, reset db
    elif data.get("sampleSize") == 0:
        os.system("python3 init_segmentationdb.py")

    # 2. resegment DB, if needed
    '''
    if sampleSize is >= 0, we reinit with a set of data point from original csv, thus we should resegment
    if sampleSize is -1, means new datapoint from UI, thus we should resegment
    if sampleSize is below -2, skip resegment, only read data from previous segmentation
    '''
    if data.get("sampleSize") >= -1:
        os.system("python3 segmentation_process.py")

    # 3. read segment results: Connect to db and read latest segmentation results
    connection = pg.connect(f"dbname='segmentationdb' user='segmentmaster' host='{host_ip}' port='5434' password='segment'")

    # Read customer data
    customers_df = pd.read_sql('select * from test', connection)

    # Read ML info (raw data) from mlinfo_raw table
    try:
        mlinfo_df = pd.read_sql('select * from mlinfo_raw', connection)
    except Exception as e:
        # Table might not exist yet on first run with sampleSize=-2
        mlinfo_df = pd.DataFrame(columns=['customer_id', 'pca_component_1', 'pca_component_2', 'segment'])

    # Get segment metadata
    segment_metadata = _get_segment_metadata(connection)

    # =====================================================================
    # IMAGE 2: Spending Score Histogram (sns.distplot)
    # Reference: sns.distplot(spending, bins=10, kde=True)
    # Frontend: Creates histogram with 10 bins + KDE overlay
    # =====================================================================
    spending_data = customers_df["spending_score"].tolist()

    # =====================================================================
    # IMAGE 3: Pairplot (sns.pairplot)
    # Reference: sns.pairplot with x_vars/y_vars = [age, annual_income, spending_score]
    #            hue="gender", kind="scatter", palette="YlGnBu"
    #
    # This creates a 3x3 grid:
    # - Diagonal: KDE/histogram of each variable (NOT scatter)
    # - Off-diagonal: Scatter plots of variable pairs
    # - Points colored by gender using YlGnBu palette
    #
    # Frontend: Creates 3x3 grid of subplots using pairplot_data arrays
    # =====================================================================

    # =====================================================================
    # IMAGE 4: Cluster Scatter Plot (plt.scatter with PCA components)
    # Reference: plt.scatter(pca_2d[:, 0], pca_2d[:, 1], c=y_means, cmap="Spectral_r")
    #
    # IMPORTANT: This plots PCA-transformed coordinates, NOT raw features!
    # - X-axis: PCA Component 1 (linear combination of age, income, spending)
    # - Y-axis: PCA Component 2 (linear combination of age, income, spending)
    # - Color: Segment assignment (0-4) using Spectral_r colormap
    #
    # Frontend: Creates SINGLE scatter plot of PCA components
    # =====================================================================

    response_data = {
        # ===== IMAGE 2: Spending Score Histogram =====
        "spending_histogram": {
            "data": spending_data,
            "bins": 10,
            "title": "spending_score"
        },

        # ===== IMAGE 3: Pairplot =====
        # Arrays format matching frontend expectations
        "pairplot_data": {
            "age": customers_df["age"].tolist(),
            "annual_income": customers_df["annual_income"].tolist(),
            "spending_score": customers_df["spending_score"].tolist(),
            "gender": customers_df["gender"].tolist()
        },

        # ===== IMAGE 4: Cluster Scatter Plot =====
        # Arrays format matching frontend expectations
        "cluster_scatter": {
            "pca_component_1": mlinfo_df["pca_component_1"].tolist() if "pca_component_1" in mlinfo_df.columns else [],
            "pca_component_2": mlinfo_df["pca_component_2"].tolist() if "pca_component_2" in mlinfo_df.columns else [],
            "segment": mlinfo_df["segment"].tolist() if "segment" in mlinfo_df.columns else [],
            "customer_id": mlinfo_df["customer_id"].tolist() if "customer_id" in mlinfo_df.columns else [],
            "n_clusters": 5,
            "title": "Domains grouped into 5 clusters"
        },

        # Segment metadata (colors and centroids)
        "segment_metadata": segment_metadata
    }

    connection.close()
    return json.dumps(response_data)


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
        # Return Spectral_r colors if metadata table doesn't exist yet
        return {
            0: {"color": "#5e4fa2"},  # Dark purple
            1: {"color": "#3288bd"},  # Blue
            2: {"color": "#66c2a5"},  # Teal/Green
            3: {"color": "#fdae61"},  # Orange
            4: {"color": "#9e0142"}   # Dark red/maroon
        }


@app.route('/addCustomer', methods=['POST'])
def addCustomer(pg=pg):
    data = request.json

    # for psycopg3 you need to use it with postgresql+psycopg manner, simple postgresql will use only psycopg2
    conn_string = f"postgresql+psycopg://segmentmaster:segment@{host_ip}:5434/segmentationdb"

    db = create_engine(conn_string)
    connection = db.connect()

    # our dataframe
    ingestion = data['fields']

    # Create DataFrame
    df = pd.DataFrame([ingestion])
    print(df)
    #connection.execute(text("SELECT setval(pg_get_serial_sequence('test', 'id'), (SELECT MAX(id) FROM test)+1);"))
    df.to_sql('test', con=connection, if_exists='append', index=False)
    connection = pg.connect(f"dbname='segmentationdb' user='segmentmaster' host='{host_ip}' port='5434' password='segment'")
    connection.autocommit = True
    connection.close()

    # Initiate the full process after each ingestion to check for drift
    #os.system("python3 fullprocess.py apitrigger")

    return jsonify(data['fields'])

app.wsgi_app = DispatcherMiddleware(index, {default_prefix: app.wsgi_app})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8600, debug=True, threaded=True)