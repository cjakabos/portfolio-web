# Web Development and Predictive Analytics Portfolio
<p align="center">
  <img src="./frontend/cloudapp-shell/public/drawing_white.svg" width="150px" height="150px" />
</p>
Welcome to my dynamic portfolio, showcasing cutting-edge projects from my Web Development and Predictive Analytics Nanodegrees. This repository is packed with full-stack solutions, ranging from microservices to interactive front-end interfaces and robust data analytics models.

## What's Inside?

- **CloudApp - Interactive Next.js 14 App Shell and Micro Frontend**: Experience the sleek Next.js interface designed to interact seamlessly with the backend services.  [Explore the frontend](./frontend/cloudapp-shell/README.md).
    - A micro frontend setup with an app shell solution to enable independently deployable front-end modules, improving scalability and maintainability. [Check details](#4-maps-with-vehicle-locations)
- **Microservices Architecture**: Dive into backend API services crafted during my Nanodegree. More about backend services: [cloudapp](./backend/cloudapp/README.md), [petstore](./backend/petstore/README.md), [vehicles-api](./backend/vehicles-api/README.md), [jira-proxy](./backend/web-proxy/README.md).
- **Load Balancer and Reverse Proxy**: Utilize Nginx to efficiently distribute traffic among servers and enhance performance and reliability of applications.   [Read more](https://www.nginx.com).
- **Advanced ML Pipeline**: Leverage my Python-based machine learning pipeline for dynamic customer segmentation, developed during my Predictive Analytics Nanodegree. [See ML details](./backend/ml-pipeline/README.md).
- **Integrated External APIs**: Enhance functionality with third-party services like OpenAI and Jira through customized proxy APIs to navigate CORS issues. [Details on API integration](#5-openai).
- **Real-Time Kafka Chat**: Engage with the Kafka-powered chat application, demonstrating real-time messaging capabilities. [Chat interface](#8-chat).
- **Efficient Logging and CI/CD**: Implement robust logging with Log4j and streamline deployments using Jenkins. [Learn about CI/CD processes](backend/cloudapp/README.md#cicd-with-jenkins).

Example view with ML customer segmentation pipeline and other tabs:
![](examples/11.png)


## Quick Start

### Setup with Docker
Note: minimum 16 GB memory is needed to make sure all services can run.
```bash
brew install docker
brew install docker-compose
```

Setup and start databases and esential services with docker-compose:
```bash
docker-compose -f docker-compose-infrastructure.yml up -d
```
Build and start the Java based services, the Python based ml-pipeline and the Next.js based frontend:
```bash
docker-compose -f docker-compose-app.yml up -d
```

Runs the app in the production mode.\
Open http://localhost:5001 to view it in your browser. For development mode check [instructions here](./frontend/cloudapp-shell/README.md#option-2-dev-mode).


If everything is correctly started, you should see a login page with optional Dark Mode:
![](examples/1.png)

And you should be able to register and log in, [after starting the backend services, cloudapp is a must, the rest is optional](#2-shop-interface-for-cloudapp-web-store-rest-api-), and see the current front-end of the api integrations from the services above:

## 1. Machine learning system for Customer Segmentation
![](examples/11.png)  

MLOps interface for [Customer Segmentation API](backend/ml-pipeline/README.md), the user is able to auto trigger the whole customer segmentation process and generate the latest segmentation plots with these options:
- Add new customer data point to the database.
- Sample reference database with user specified samples.
- Sample reference database with predefined 10-20-50-100-200 amount of samples.  


View results:
- Pictures: correlation between parameters and the different segments.
- Table: current list of customers from postgres db.

The module is built as Micro Frontend:  
1. Left side main CloudApp-Shell as App Shell using the MLOps micro frontend:  
http://localhost:5001/mlops  
2. Right side module federated MLOps micro frontend:   
http://localhost:5005  

![](examples/11a.png)


## 2. Shop interface for [Cloudapp web store REST API](backend/cloudapp/README.md), 
![](examples/4.png)
The user is able to:
- Create new items.
- Add existing items to the cart.
- See and clear the cart.
- Submit cart and check order history.  

Shop API documentation: 
- [Items](http://localhost:8099/cloudapp/swagger-ui/index.html#/item-controller)
- [Cart](http://localhost:8099/cloudapp/swagger-ui/index.html#/cart-controller)
- [Order](http://localhost:8099/cloudapp/swagger-ui/index.html#/order-controller)

## 3. Pet Store interface for the [Pet Store's REST API](backend/petstore/README.md)
The module is built as Micro Frontend:  
1. Left side main CloudApp-Shell as App Shell using the Petstore micro frontend:  
http://localhost:5001/petstore  
2. Right side module federated Petstore micro frontend:   
http://localhost:5006

![](examples/5.png)
The user is able to:
- Add new customer.
- Add a new Pet to existing customers.
- Add new employees with skills and schedules.
- Check availability based on skills and schedules.
- Plan a new schedule for an employee and assign it to a pet.


## 4.  Maps with vehicle locations
The module is built as Micro Frontend:  
1. Left side main CloudApp-Shell as App Shell using the Maps micro frontend:  
http://localhost:5001/maps  
2. Right side module federated Maps micro frontend:   
http://localhost:5002

![](examples/8.png)
Map interface for integrating Open Street Map with the [Vehicle location service's REST API](backend/vehicles-api/README.md).
The user is able to:
- Click on the map to add new vehicle locations.
- Click on existing locations and check basic info and delete the location.  

Vehicels [API documentation](http://localhost:8880/vehicles/swagger-ui.html)

## 5. OpenAI
![](examples/9.png)
OpenAI interface for communicating with
the [OpenAI API](https://platform.openai.com/docs/api-reference), the user is able to:
- Send a prompt to ChatGPT and receive a response.
- Send a prompt to DallE and receive an image response.

The module is built as Micro Frontend:  
1. Left side main CloudApp-Shell as App Shell using the OpenAI micro frontend:  
http://localhost:5001/openai
2. Right side module federated OpenAI micro frontend:   
http://localhost:5004

![](examples/9a.png)
  

## 6. Jira
Jira interface for communicating with
the [Jira API](https://platform.openai.com/docs/api-reference), to use it:
- [Register](https://www.atlassian.com/software/jira/free)
- [Create Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
- [Use it for requests](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/)

The user is able to:

- Create/list/update/delete Jira ticket  
1. Left side main CloudApp-Shell as App Shell using the Jira micro frontend:  
   http://localhost:5001/jira
2. Right side module federated Jira micro frontend:   
   http://localhost:5003
![](examples/10.png)

## 7. Notes and Files
A service for creating personal notes and uploading personal files.
![](examples/12.png)
- Notes [API documentation](http://localhost:8099/cloudapp/swagger-ui/index.html#/note-controller)
- Files [API documentation](http://localhost:8099/cloudapp/swagger-ui/index.html#/file-controller)
## 8. Chat
A Kafka based chat service, the user is able to:

- Create new chat rooms, furthermore share and enter chat room id  

![](examples/13.png)
- Talk to other users in chat rooms  

![](examples/14.png)


# Optional API services

If OpenAI and Jira functionality is to be used, follow the instructions below:

## OpenAI API key:
Comment out this in the [docker-compose-app.yml](./docker-compose-app.yml) file in root directory:

```bash
NEXT_PUBLIC_OPENAI_KEY: sk-za-------YOUR-API-KEY------8Ie
```
## Jira API key, [how to register](https://www.atlassian.com/software/jira/free) and [how to get an API key](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

Comment out these in the [docker-compose-app.yml](./docker-compose-app.yml) file in root directory:

```bash
NEXT_PUBLIC_JIRA_DOMAIN: 'https://your-jira-instance.atlassian.net'
NEXT_PUBLIC_JIRA_KEY: Y3NhYmFqYWthYm-------YOUR-API-KEY------SDA9REUzRjY4N0M=
```
NOTE: the next-frontend Docker image needs to be rebuilt after editing the .env file.

## Certificates
[Web Development Nanodegree certficiate](https://graduation.udacity.com/confirm/QDDKHJF9)  

[Predictive Analytics for Business Nanodegree certficiate](https://confirm.udacity.com/e/3ac984b2-6128-11ee-a6fe-9be76f9bc811)




