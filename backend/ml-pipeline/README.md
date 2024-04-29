# Machine learning system for Customer Segmentation

This is a Machine Learning project for Customer Segmentation. The problem is to create, deploy, and monitor a customer segmentation ML model.

You are the owner of a shop. It doesn't matter if you own an e-commerce or a supermarket. It doesn't matter if it is a small shop or a huge company such as Amazon or Netflix, it's better to know your customers.

You were able to collect basic data about your customers holding a membership card such as Customer ID, age, gender, annual income, and spending score. This last one is a score based on customer behavior and purchasing data. There are some new products on the market that you are interested in selling. But you want to target a specific type of clients for each one of the products.

Machine learning comes in handy for this task. Particularly, clustering, the most important unsupervised learning problem, is able to create categories grouping similar individuals. These categories are called clusters. A cluster is a collection of points in a dataset. These points are more similar between them than they are to points belonging to other clusters. Distance-based clustering groups the points into some number of clusters such that distances within the cluster should be small while distances between clusters should be large.

[Detailed info of the cluster process](https://github.com/cjakabos/portfolio-business-analytics/blob/main/Project6_Extra/customers/clustering_analysis.ipynb), the Machine learning system is a live implementation of the same Jupyter notebook.

<p align="center">
	<img src="customers/Screen.png" >
</p>  

## Prerequisites
- Python 3 required
- Virtualenv recommended

## Dependencies
This project dependencies is available in the ```requirements.txt``` file.

## Installation
Use the package manager [pip](https://pip.pypa.io/en/stable/) to install the dependencies from the ```requirements.txt```. Its recommended to install it in a separate [virtual environment](https://virtualenv.pypa.io/en/latest/).

## Project Structure
```bash
📦Dynamic-Customer-Segmentation-System
 ┣
 ┣ 📂customers
 ┃ ┗ 📜customers.csv    # Contains csv to initiate db
 analysis
 ┣ 📂react-mlops-app                # React UI to interact add new customers, run segmentation and visualize segmentation results
 ┣ 📂src
 ┃ ┣ 📜app.py                       # Flask app
 ┃ ┣ 📜init_segmentationdb.py       # DB setup script to initiate postgres db based on customers.csv
 ┃ ┗ 📜segmentation_process.py      # The whole segmentation process for reading data, estimating segments and writing it to db, based on [Detailed info of the cluster process](https://github.com/cjakabos/portfolio-business-analytics/blob/main/Project6_Extra/customers/clustering_analysis.ipynb)
 ┗ 📜requirements.txt               # Projects required dependencies
```

## Usage

### 1- Setup postgres db
Install postgres and start it
```bash
brew install postgresql@15
brew services start postgresql@15
echo 'export PATH=/opt/homebrew/opt/postgresql@15/bin/postgres:$PATH  ' >> ~/.zshrc
psql postgres
```

Create segmentationdb

```sql
CREATE DATABASE segmentationdb;

CREATE USER segmentmaster WITH PASSWORD 'segment';

GRANT ALL ON DATABASE segmentationdb TO segmentmaster;

ALTER DATABASE segmentationdb OWNER TO segmentmaster;

GRANT ALL PRIVILEGES ON DATABASE segmentationdb TO segmentmaster;

\c riskdb segmentmaster

GRANT ALL ON SCHEMA public TO segmentmaster;

exit
```

### 2- Run init_segmentationdb and Flask App in one terminal, run the rest of the steps in another terminal
```bash
virtualenv venv
source venv/bin/active
pip3 install -r requirements.txt
cd src
python3 init_segmentationdb.py
python3 app.py
```

Example of sending a new customer request, this will triger the full Customer Segmentation pipeline:
```
curl -H "Content-Type: application/json" -X POST -d \
'{
    "fields": {
       "gender": "Female",
       "age": 35,
       "annual_income": 335,
       "spending_score": 95,
       "segment": 0
   }
}' \
http://127.0.0.1:8600/mlops-segmentation/addCustomer
```
### 3- Run Flask App in separate terminal, run the rest of the steps in another terminal
```bash
cd react-mlops-app
npm install
npm start
```

Go to: http://localhost:5001/

And there are several options for the user:
1. Add new customer data point to the database.
2. Sample reference database with user specified samples.
3. Sample reference database with predefined 10-20-50-100-200 amount of samples.
All these steps will retrigger the segmentation process and then the pictures and tables will update with the new results.

View results:  
- Pictures: correlation between parameters and the different segments  
- Table: current db from postgres.

<p align="center">
	<img src="customers/Screen.png" >
</p>  
