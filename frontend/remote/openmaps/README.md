# CloudApp for [API service integration](#required-api-services)

<p align="center">
  <img src="./public/drawing.svg" style="background-color:white;" width="150px" height="150px" />
</p>

## REACT front-end

### Option 1. Out of the box mode:  

  Setup and start databases and essential services with docker-compose:
  ```bash
  docker-compose -f docker-compose-infrastructure.yml up -d
  ```
  Build and start the Java based services, the Python based ml-pipeline and the Next.js based frontend:
  ```bash
  docker-compose -f docker-compose-app.yml up -d
  ```
Note: configure Ollama model to use with LLM_MODEL in docker-compose-infrastructure.yml, in this example it was deepseek-r1 with 1.5B parameter, good enough for local testing purposes.
```dockerfile
  ollama:
    container_name: ollama
    build:
      context: ./
      dockerfile: Dockerfile_OLLAMA
      args:
        NEXT_PUBLIC_LLM_MODEL: 'deepseek-r1:1.5b'
    ports:
      - 11434:11434
```

If everything is working as expected, you should be able to:
- Open [http://localhost:5001](http://localhost:5001) for the main Cludapp app-shell to view micro-frontends.
- Open [http://localhost:5002](http://localhost:5002) for the OpenMaps micro-frontend.
- Open [http://localhost:5003](http://localhost:5003) for the Jira micro-frontend.
- Open [http://localhost:5333](http://localhost:5333) for the Local LLM AI micro-frontend.
- Open [http://localhost:5005](http://localhost:5005) for the MLOps micro-frontend.
- Open [http://localhost:5006](http://localhost:5006) for the Petstore micro-frontend.

### Option 2. Dev mode:

Install packages and start React front-end from root of cloudapp-shell and /remote microfrontends:

```bash
npm install
npm run dev
```

Runs the app in the development mode.

The page will reload when you make changes.\
You may also see any lint errors in the console.

If everything is correctly started, you should see a login page with optional Dark Mode:
<p align="center">
  <img src="../../examples/1a.png" width="210px" height="150px" />
</p>

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
The module is built as Micro Frontend:
1. Left side main CloudApp-Shell as App Shell using the Petstore micro frontend:  
   http://localhost:5001/petstore
2. Right side module federated Petstore micro frontend:   
   http://localhost:5006  

![](../../examples/5.png)  

The user is able to:
- Add new customer.
- Add a new Pet to existing customers.
- Add new employees with skills and schedules.
- Check availability based on skills and schedules.
- Plan a new schedule for an employee and assign it to a pet.


## 4.  Maps with Micro Frontend Module federation
1. Left side main CloudApp-Shell as App Shell using the Maps micro frontend:
http://localhost:5001/maps  
2. Right side module federated Maps micro frontend:   
http://localhost:5002  

![](../../examples/8.png)
Map interface for integrating Open Street Map with the [Vehicle location service's REST API](backend/vehicles-api/README.md).
The user is able to:
- Click on the map to add new vehicle locations.
- Click on existing locations and check basic info and delete the location.

Vehicels [API documentation](http://localhost:8880/vehicles/swagger-ui.html)

## 5. Private Local LLM AI
Chat  interface for communicating with
a locally hosted Ollama model, the user is able to:
- Chat with a local LLM (and see model reasoning process, in models where it is applicable - can be toggled)

The module is built as Micro Frontend:
1. Left side main CloudApp-Shell as App Shell using the Local LLM AI micro frontend:  
   http://localhost:5001/chatllm
2. Right side module federated Local LLM AI micro frontend:   
   http://localhost:5333

![](../../examples/9.png)

3. Optionally one can also use command line:
```bash
curl http://localhost:11434/api/generate -d '{                              
  "model": "deepseek-r1:1.5b",
  "prompt": "Why is the sky blue?"
}'
```

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

If Jira functionality is to be used, follow the instructions below:

## Jira API key, [how to register](https://www.atlassian.com/software/jira/free) and [how to get an API key](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

Two options:
1. Out of the box: edit this in docker-compose-app.yml:
```
#NEXT_PUBLIC_JIRA_DOMAIN: 'https://your-jira-instance.atlassian.net'
#NEXT_PUBLIC_JIRA_API_TOKEN: Y3NhYmFqYWthYm-------YOUR-API-KEY------SDA9REUzRjY4N0M=
#NEXT_PUBLIC_JIRA_PROJECT_KEY: 'yourjiraprojectkey'
#NEXT_PUBLIC_JIRA_EMAIL: 'youremail'
```
2. Local run: Add .env file at frontend/remote/jira directory in this format:
```bash
NEXT_PUBLIC_JIRA_DOMAIN = 'https://xxxx.atlassian.net'
NEXT_PUBLIC_JIRA_API_TOKEN = Y3......2edd (note: no single quotation)
NEXT_PUBLIC_JIRA_PROJECT_KEY: 'yourjiraprojectkey'
NEXT_PUBLIC_JIRA_EMAIL: 'youremail'
```
NOTE: the next-frontend Docker image needs to be rebuilt after editing the .env file.
