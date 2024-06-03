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
    data_df = pd.read_sql('select * from mlinfo', connection)
    #print(data_df['image2'][0])
    encoded_img2 = base64.b64encode(data_df['image2'][0]).decode("utf-8")
    encoded_img3 = base64.b64encode(data_df['image3'][0]).decode("utf-8")
    encoded_img4 = base64.b64encode(data_df['image4'][0]).decode("utf-8")

    value = {
        "image2": encoded_img2,
        "image3": encoded_img3,
        "image4": encoded_img4
    }

    return json.dumps(value)

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
