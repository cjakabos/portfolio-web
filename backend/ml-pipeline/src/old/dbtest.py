"""
Author: Csaba Jakabos
Date: December, 2023
This script used to test the postgres DB connection with psycopg
"""
# Note: the module name is psycopg, not psycopg3
import psycopg

# Connect to an existing database
with psycopg.connect(f"dbname=riskdb user=riskmaster") as conn:

    # Open a cursor to perform database operations
    with conn.cursor() as cur:

        # Execute a command: this creates a new table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS test (
                id serial PRIMARY KEY,
                corporation text,
                lastmonth_activity integer,
                lastyear_activity integer,
                number_of_employees integer,
                exited integer)
            """)

        # Pass data to fill a query placeholders and let Psycopg perform
        # the correct conversion (no SQL injections!)
        cur.execute(
            "INSERT INTO test (corporation, lastmonth_activity, lastyear_activity, number_of_employees, exited) VALUES (%s, %s, %s, %s, %s)",
            ("Risky AB", 234, 3, 10, 1))

        # Query the database and obtain data as Python objects.
        cur.execute("SELECT * FROM test")
        cur.fetchone()
        # will return (1, "Risky AB", 234, 3, 10, 1)

        # You can use `cur.fetchmany()`, `cur.fetchall()` to return a list
        # of several records, or even iterate on the cursor
        for record in cur:
            print(record)

        # Make the changes to the database persistent
        conn.commit()