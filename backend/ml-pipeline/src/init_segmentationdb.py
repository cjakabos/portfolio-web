"""
Author: Csaba Jakabos
Date: December, 2023
This script used to init segmentationDB postgres DB
"""
# Note: the module name is psycopg, not psycopg3
import os
import sys
import psycopg
import pandas as pd
import psycopg as pg
from sqlalchemy import create_engine
from sqlalchemy.sql import text

host_ip = os.getenv('DOCKER_HOST_IP', 'localhost')

def to_sql_seq(df,table_name, engine):

    get_seq_id_sql = f"""
                       select your_sequence.nextval as id
                        from dual
                         connect by level < {df.shape[0]}
                     """

    # sql_get_max_id = f'select max({index_name}) as id from {table_name}'

    s_id = pd.read_sql(get_seq_id_sql , engine)

    df.index =s_id['id'].values
    df.index.name=index_name
    df.to_sql(table_name,engine,if_exists='append')
    return

def main():
    # Connect to an existing database
    with psycopg.connect(f"postgres://segmentmaster:segment@{host_ip}:5434/segmentationdb") as conn:

        # Open a cursor to perform database operations
        with conn.cursor() as cur:

            # Execute a command: this creates a new table
            cur.execute("""
                DROP TABLE IF EXISTS test;
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

    conn_string = f"postgresql+psycopg://segmentmaster:segment@{host_ip}:5434/segmentationdb"

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
    df.to_sql('test', con=conn, if_exists="append", index=False)
    print(df.shape[0])
    #to_sql_seq(df, 'test', db)
    conn.execute(text("SELECT setval(pg_get_serial_sequence('test', 'id'), (SELECT MAX(id) FROM test));"))

    conn = pg.connect(f"dbname='segmentationdb' user='segmentmaster' host='{host_ip}' port='5434' password='segment'")
    conn.autocommit = True

    conn.close()







if __name__ == '__main__':
    main()