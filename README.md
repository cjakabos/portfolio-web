# Web development portfolio

This is a collection of my development projects from Web Development and Predictive Analytics Nanodegrees:
- Back-end [API services](#required-api-services) developed by me during my Nanodegree [Web Development at Udacity](https://www.udacity.com/course/java-developer-nanodegree--nd035).
- Next.js 14 front-end [interface](#react-front-end) for utilizing these back-end services from above and new services below.
- ML pipeline for [Dynamic Customer Segmentation](#1-machine-learning-system-for-customer-segmentation), building on my Nanodegree in [Predictive Analytics for Business](https://www.udacity.com/course/predictive-analytics-for-business-nanodegree--nd008t)
- External api service integration, such as:
  - [OpenAI API](#5-openai)
  - [Jira API with an internal proxy API service to avoid CORS](#6-jira)
- [Kafka based Chat](#8-chat)
- [Logging with log4j](backend/cloudapp/README.md#logging-with-slf4j-and-log4j) and [CI/CD with Jenkins](backend/cloudapp/README.md#cicd-with-jenkins)

Example view with ML pipeline and other tabs:
![](examples/example8.png)

## Certificates
[Predictive Analytics for Business Nanodegree certficiate](https://confirm.udacity.com/e/3ac984b2-6128-11ee-a6fe-9be76f9bc811)

[Web Development Nanodegree certficiate](https://graduation.udacity.com/confirm/QDDKHJF9)

## REACT front-end

Add .env file at root:
```bash
NEXT_PUBLIC_JIRA_DOMAIN = 'https://xxxx.atlassian.net'
NEXT_PUBLIC_JIRA_KEY = Y3......2edd (note: no single quotation)
NEXT_PUBLIC_OPENAI_KEY=xxxxxxxxxxxxxx
```

Install packages and start React front-end from root of react-apiview-app:

```bash
npm install
npm run dev
```

Runs the app in the development mode.\
Open http://localhost:5001 to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

If everything is correctly started, you should see a login page:
![](examples/example1.png)

And you should be able to register and log in, [after starting the backend services, cloudapp is a must, the rest is optional](#2-cloudapp-api), and see the current front-end of the api integrations from the services above:
![](examples/example2.png)

## 1. Machine learning system for Customer Segmentation
![](examples/example8.png)  
MLOps interface for [Customer Segmentation API](backend/ml-pipeline/README.md), the user is able to:
- Add new customer data point to the database.
- Sample reference database with user specified samples.
- Sample reference database with predefined 10-20-50-100-200 amount of samples.
   All these steps will retrigger the segmentation process and then the pictures and tables will update with the new results.

View results:
- Pictures: correlation between parameters and the different segments
- Table: current db from postgres.


## 2. Shop interface for [Cloudapp web store REST API](backend/cloudapp/README.md), 
![](examples/example3.png)
The user is able to:
- Create new items.
- Add existing items to the cart.
- See and clear the cart.
- Submit cart and check order history.
  

## 3. Pet Store interface for the [Pet Store's REST API](backend/petstore/README.md)
![](examples/example4.png)
The user is able to:
- Add new customer.
- Add a new Pet to existing customers.
- Add new employees with skills and schedules.
- Check availability based on skills and schedules.
- Plan a new schedule for an employee and assign it to a pet.


## 4.  Maps
![](examples/example5.png)
Map interface for integrating Open Street Map with the [Vehicle location service's REST API](backend/vehicles-api/README.md).
The user is able to:
- Click on the map to add new vehicle locations.
- Click on existing locations and check basic info and delete the location.
  

## 5. OpenAI
![](examples/example6.png)
OpenAI interface for communicating with
the [OpenAI API](https://platform.openai.com/docs/api-reference), the user is able to:
- Send a prompt to ChatGPT and receive a response..
- Send a prompt to DallE and receive an image response.
  

## 6. Jira
Jira interface for communicating with
the [Jira API](https://platform.openai.com/docs/api-reference), to use it:
- [Register](https://www.atlassian.com/software/jira/free)
- [Create Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
- [Use it for requests](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/)

The user is able to:

- Create/list/update/delete Jira ticket
  ![](examples/example7.png)  

## 7. Notes and Files
A service for creating personal notes and uploading personal files.
![](examples/example9.png)

## 8. Chat
A Kafka based chat service, the user is able to:

- Create new chat rooms, furthermore share and enter chat room id
![](examples/example10.png)
- Talk to other users in chat rooms
![](examples/example11.png)
  



# Required background services

In the repository start these 4 backend API, Kafka and MongoDB services in different terminals

## 1. MLOps api:

1- Setup postgres db
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
\c segmentationdb segmentmaster
GRANT ALL ON SCHEMA public TO segmentmaster;
exit
```

2- Run init_segmentationdb and Flask App in one terminal, run the rest of the steps in another terminal
```bash
virtualenv venv
source venv/bin/active
pip3 install -r requirements.txt
cd src
python3 init_segmentationdb.py
python3 app.py
```

## 2. Cloudapp api:

Create cloudappdb

```sql
CREATE DATABASE cloudappdb;
CREATE USER websitemaster WITH PASSWORD 'local';
GRANT ALL ON DATABASE cloudappdb TO websitemaster;
ALTER DATABASE cloudappdb OWNER TO websitemaster;
GRANT ALL PRIVILEGES ON DATABASE cloudappdb TO websitemaster;
\c cloudappdb websitemaster
GRANT ALL ON SCHEMA public TO websitemaster;
exit
```

```
cd cloudapp
mvn clean package
java -jar target/cloudapp-0.0.1-SNAPSHOT.jar
```

Swagger, note the "Authorize" button for jwt authorization: http://localhost:8099/swagger-ui/index.html#/

## 3. Vehicles api:

```
cd vehicles-api
mvn clean package
java -jar target/vehicles-api-0.0.1-SNAPSHOT.jar
```

## 4. Pet Store api:

```bash
#Install msql, eg. on mac:
brew install mysql
brew services start mysql

#Start mysql and flush privileges, if issues arise:
mysql -u root    
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY ‘root’;

```

```sql
--Create db:
CREATE SCHEMA `petstore` ; -- Create the petstore database
CREATE USER 'root'@'localhost' IDENTIFIED BY 'root'; -- Create the user if you haven’t yet
ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; -- Make sure that the password is set
GRANT ALL ON petstore.* TO 'root'@'localhost'; -- Gives all privileges to the new user on petstore
```

```bash
#start the service from repo root:
cd petstore
mvn clean package
java -jar target/petstore-0.0.1-SNAPSHOT.jar
```

## 5. Kafka and MongoDB for Chat service:

Install, start and initialize MongoDB
```
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb/brew/mongodb-community
brew services start mongodb-community@7.0
mongosh
use cloudappdb
db.user.insertOne({name: "Test User", age: 999})
```

Install Kafka and Zookeeper
```
brew install kafka
brew install zookeeper
brew services start zookeeper
brew services start kafka
```

Create chat topic
```
kafka-topics --bootstrap-server localhost:9092 --topic chat --create --partitions 3 --replication-factor 1
```

# Optional api services

If OpenAI and Jira functionality is to be used, follow the instructions below:

## OpenAI API key:

```
To be stored in the .env file in the frontend/react-apiview-app root directory in this format:
NEXT_PUBLIC_OPENAI_KEY==xxxxxxxxxxxxxx
```
## Jira API key, [how to register](https://www.atlassian.com/software/jira/free) and [how to get an API key](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

```
To be stored in the .env file in the frontend/react-apiview-app root directory in this format:
NEXT_PUBLIC_JIRA_KEY=XXXXXXXXXX
Together with your requested domain name
NEXT_PUBLIC_JIRA_DOMAIN="https:/XXXXX.atlassian.net"
```
## Start web-proxy for Jira
Start [Web Proxy API](backend/web-proxy/README.md) to avoid CORS issue with Jira [background](https://jira.atlassian.com/browse/JRASERVER-59101?focusedCommentId=2406855&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel#comment-2406855)
```
mvn clean package
java -jar target/web-proxy-0.0.1-SNAPSHOT.jar
```




