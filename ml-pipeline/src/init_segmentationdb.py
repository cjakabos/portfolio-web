"""
Author: Csaba Jakabos
Date: December, 2023
This script used to init segmentationDB postgres DB
"""
# Note: the module name is psycopg, not psycopg3
import sys
import psycopg
import pandas as pd
import psycopg as pg
from sqlalchemy import create_engine

def main():
    # Connect to an existing database
    with psycopg.connect("dbname=segmentationdb user=segmentmaster") as conn:

        # Open a cursor to perform database operations
        with conn.cursor() as cur:

            # Execute a command: this creates a new table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS test (
                    id serial PRIMARY KEY,
                    gender text,
                    age integer,
                    annual_income integer,
                    spending_score integer,
                    segment integer)
                """)

            # Execute a command: this creates a new table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS mlinfo (
                    id serial PRIMARY KEY,
                    image2 bytea,
                    image3 bytea,
                    image4 bytea)
                """)
        conn.commit()
    # for psycopg3 you need to use it with postgresql+psycopg manner, simple postgresql will use only psycopg2
    # TODO: another pro tip: https://stackoverflow.com/a/63178240/1026

    conn_string = "postgresql+psycopg://segmentmaster:segment@localhost/segmentationdb"

    db = create_engine(conn_string)
    conn = db.connect()

    if len(sys.argv) > 1:
        print(sys.argv[1])
        with open('../customers/customers.csv', 'r') as file:
            df = pd.read_csv(file, nrows=int(sys.argv[1]))
    else:
        with open('../customers/customers.csv', 'r') as file:
            df = pd.read_csv(file)


    #TODO: check indexing df.to_sql('test', con=conn, index=True, index_label='id', if_exists='append')
    df.to_sql('test', con=conn, index=False, if_exists='replace')

    conn = pg.connect("dbname='segmentationdb' user='segmentmaster' host='127.0.0.1' port='5432' password='segment'")
    conn.autocommit = True

if __name__ == '__main__':
    main()