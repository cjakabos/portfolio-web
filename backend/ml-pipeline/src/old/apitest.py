"""
Author: Csaba Jakabos
Date: December, 2023
This script used to test the ingest API endpoint
"""
# Note: the module name is psycopg, not psycopg3
import requests

url = 'http://localhost:8000/ingest'
myobj = {'fields': {'corporation': 'Very Risky AB','lastmonth_activity': 775,'lastyear_activity': 335,'number_of_employees': 54,'exited': 0}}

x = requests.post(url, json = myobj)