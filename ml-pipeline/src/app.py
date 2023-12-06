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

from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from sqlalchemy import create_engine

import diagnostics


# Set up variables for use in our script
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5001"}})
app.config['CORS_HEADERS'] = 'Content-Type'


@app.route('/')
@cross_origin()
def index():
    return "Hello World"

@app.route('/getCustomers', methods=['GET'])
def getCustomers(pg=pg):
    connection = pg.connect("dbname='riskdb' user='riskmaster' host='127.0.0.1' port='5432' password='apetite'")
    data_df = pd.read_sql('select * from test', connection)
    return data_df.to_json(orient='records')

#inspiration: https://www.geeksforgeeks.org/how-to-insert-a-pandas-dataframe-to-an-existing-postgresql-table/
@app.route('/ingest', methods=['POST'])
def ingest(pg=pg):
    data = request.json
    print(data)

    #connection = pg.connect("dbname='riskdb' user='riskmaster' host='127.0.0.1' port='5432' password='apetite'")
    #data_df = pd.read_sql('select * from test', connection)

    # for psycopg3 you need to use it with postgresql+psycopg manner, simple postgresql will use only psycopg2
    conn_string = "postgresql+psycopg://riskmaster:apetite@localhost/riskdb"

    db = create_engine(conn_string)
    conn = db.connect()

    # our dataframe
    ingestion = data['fields']

    # Create DataFrame
    df = pd.DataFrame([ingestion])
    df.to_sql('test', con=conn, if_exists='append', index=False)
    conn = pg.connect("dbname='riskdb' user='riskmaster' host='127.0.0.1' port='5432' password='apetite'")
    conn.autocommit = True
    #cursor = conn.cursor()

    #sql1 = '''select * from test;'''
    #cursor.execute(sql1)

    #for i in cursor.fetchall():
    #    print(i)

    # conn.commit()
    conn.close()

    # Initiate the full process after each ingestion to check for drift
    os.system("python3 fullprocess.py apitrigger")

    return jsonify(data['fields'])

@app.route("/prediction", methods=['POST', 'OPTIONS'])
@cross_origin()
def predict():
    """
    Prediction endpoint that loads data given the file path
    and calls the prediction function in diagnostics.py

    Returns:
        json: model predictions
    """
    filepath = request.get_json()['filepath']

    df = pd.read_csv(filepath)
    df = df.drop(['corporation', 'exited'], axis=1)

    preds = diagnostics.model_predictions(df)
    return jsonify(preds.tolist())


@app.route("/scoring", methods=['GET', 'OPTIONS'])
@cross_origin()
def score():
    """
    Scoring endpoint that runs the script scoring.py and
    gets the score of the deployed model

    Returns:
        str: model f1 score
    """
    output = subprocess.run(['python', 'scoring.py'],
                            capture_output=True).stdout
    output = re.findall(r'f1 score = \d*\.?\d+', output.decode())[0]
    return output


@app.route("/summarystats", methods=['GET', 'OPTIONS'])
@cross_origin()
def stats():
    """
    Summary statistics endpoint that calls dataframe summary
    function from diagnostics.py

    Returns:
        json: summary statistics
    """
    return jsonify(diagnostics.dataframe_summary())


@app.route("/diagnostics", methods=['GET', 'OPTIONS'])
@cross_origin()
def diag():
    """
    Diagnostics endpoint thats calls missing_percentage, execution_time,
    and outdated_package_list from diagnostics.py

    Returns:
        dict: missing percentage, execution time and outdated packages
    """
    missing = diagnostics.missing_percentage()
    time = diagnostics.execution_time()
    outdated = diagnostics.outdated_packages_list()

    ret = {
        'missing_percentage': missing,
        'execution_time': time,
        'outdated_packages': outdated
    }

    return jsonify(ret)


if __name__ == "__main__":
    app.run(host='127.0.0.1', port=8600, debug=True, threaded=True)
