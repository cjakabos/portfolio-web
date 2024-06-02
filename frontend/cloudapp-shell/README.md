# CloudApp for [API service integration](#required-api-services)

<p align="center">
  <img src="./public/drawing.svg" style="background-color:white;" width="150px" height="150px" />
</p>

## REACT front-end

### Option 1. Out of the box mode:  

  Setup and start databases and esential services with docker-compose:
  ```bash
  docker-compose -f docker-compose-infrastructure.yml up -d
  ```
  Build and start the Java based services, the Python based ml-pipeline and the Next.js based frontend:
  ```bash
  docker-compose -f docker-compose-app.yml up -d
  ```
  
  Install packages and start React front-end from root of cloudapp-shell and remote/openmaps:
  
  ```bash
  npm install
  npm run dev
  ```

### Option 2. Dev mode:

Install packages and start React front-end from root of cloudapp-shell and remote/openmaps:

```bash
npm install
npm run dev
```

Runs the app in the development mode.\
Open [http://localhost:5001](http://localhost:5001) to view the main App Shell in your browser.  
Open [http://localhost:5002](http://localhost:5002) to view the Module Federated OpenMaps micro frontend in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

If everything is correctly started, you should see a login page with optional Dark Mode:
![](../../examples/1.png)

And you should be able to register and log in, [after starting the backend services, cloudapp is a must, the rest is optional](#2-cloudapp-api), and see the current front-end of the api integrations from the services above:

## 1. Machine learning system for Customer Segmentation
![](../../examples/11.png)  
MLOps interface for [Customer Segmentation API](../../backend/ml-pipeline/README.md), the user is able to:
- Add new customer data point to the database.
- Sample reference database with user specified samples.
- Sample reference database with predefined 10-20-50-100-200 amount of samples.
  All these steps will retrigger the segmentation process and then the pictures and tables will update with the new results.

View results:
- Pictures: correlation between parameters and the different segments
- Table: current db from postgres.


## 2. Shop interface for [Cloudapp web store REST API](../../backend/cloudapp/README.md),
![](../../examples/4.png)
The user is able to:
- Create new items.
- Add existing items to the cart.
- See and clear the cart.
- Submit cart and check order history.

Shop API documentation:
- [Items](http://localhost:8099/cloudapp/swagger-ui/index.html#/item-controller)
- [Cart](http://localhost:8099/cloudapp/swagger-ui/index.html#/cart-controller)
- [Order](http://localhost:8099/cloudapp/swagger-ui/index.html#/order-controller)

## 3. Pet Store interface for the [Pet Store's REST API](../../backend/petstore/README.md)
![](../../examples/5.png)
The user is able to:
- Add new customer.
- Add a new Pet to existing customers.
- Add new employees with skills and schedules.
- Check availability based on skills and schedules.
- Plan a new schedule for an employee and assign it to a pet.


## 4.  Maps with Micro Frontend Module federation
Left side main CloudApp-Shell as App Shell using the Maps micro frontend:
http://localhost:5001/maps  
Right side module federated Maps micro frontend:   
http://localhost:5002
![](../../examples/8.png)
Map interface for integrating Open Street Map with the [Vehicle location service's REST API](backend/vehicles-api/README.md).
The user is able to:
- Click on the map to add new vehicle locations.
- Click on existing locations and check basic info and delete the location.

Vehicels [API documentation](http://localhost:8880/vehicles/swagger-ui.html)

## 5. OpenAI
![](../../examples/9.png)
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

![](../../examples/10.png)

## 7. Notes and Files
A service for creating personal notes and uploading personal files.
![](../../examples/12.png)
- Notes [API documentation](http://localhost:8099/cloudapp/swagger-ui/index.html#/note-controller)
- Files [API documentation](http://localhost:8099/cloudapp/swagger-ui/index.html#/file-controller)
## 8. Chat
A Kafka based chat service, the user is able to:

- Create new chat rooms, furthermore share and enter chat room id

![](../../examples/13.png)
- Talk to other users in chat rooms

![](../../examples/14.png)


# Optional API services

If OpenAI and Jira functionality is to be used, follow the instructions below:

## OpenAI API key:
To be stored in the .env file in the frontend/cloudapp-shell root directory in this format:

```bash
NEXT_PUBLIC_OPENAI_KEY==xxxxxxxxxxxxxx
```
## Jira API key, [how to register](https://www.atlassian.com/software/jira/free) and [how to get an API key](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

Frontend: Add .env file at frontend/cloudapp-shell root directory in this format:
```bash
NEXT_PUBLIC_JIRA_DOMAIN = 'https://xxxx.atlassian.net'
NEXT_PUBLIC_JIRA_KEY = Y3......2edd (note: no single quotation)
```
NOTE: the next-frontend Docker image needs to be rebuilt after editing the .env file.
