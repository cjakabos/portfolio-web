# Web development portfolio

This is a collection of my hobby development projects:
- Back-end API services and basic HTML front-end developed by me during my Nanodegree [Java Web Development at Udacity](https://www.udacity.com/course/java-developer-nanodegree--nd035), combined to a user interface.
- New React front-end for utilizing these back-end services from above and new services below. [React Apiview App](frontend/react-apiview-app/README.md)
- New ML pipeline for [Dynamic Customer Segmentation](backend/ml-pipeline/README.md)
- External api service integration, such as:
  - [OpenAI API](frontend/react-apiview-app/README.md#openai)
  - [Google Maps API](frontend/react-apiview-app/README.md#googlemaps)
  - [Jira API](frontend/react-apiview-app/README.md#jira)
- [Logging with log4j](cloudapp/README.md#logging-with-slf4j-and-log4j) and [CI/CD with Jenkins](cloudapp/README.md#cicd-with-jenkins)

## Certificates
  [Predictive Analytics for Business Nanodegree certficiate](https://confirm.udacity.com/e/3ac984b2-6128-11ee-a6fe-9be76f9bc811)

  [Web Development Nanodegree certficiate](https://graduation.udacity.com/confirm/QDDKHJF9)  


## Roadmap

Development roadmap with requirements and milestones.

Three base layers of storage application for Files, Notes and Credentials. They are
the [first project](cloudinterface/README.md) of the nanodegree program and can run standalone without the extra layers
below (these will report service is unavailable at the respective tab).

- [x] The cloud service back-end with Spring Boot
- [x] The cloud service front-end with Thymeleaf
- [x] Cloud service application tests with Selenium

Extra layers of cloud interface application, which are extra curriculum work by me, to connect all standalone projects (
for running them separately check the READMEs below)to one main front-end interface:

- [x] Cars interface for the Car service's REST API. The [second project](vehicles-api/README.md) of the nanodegree.
- [x] Pet interface for the Pet Store's REST API. The [third project](backend/petstore/README.md) of the nanodegree.
- [x] Cloudapp interface for Cloudapp web store REST API. The [fourth project](cloudapp/README.md) of the nanodegree.
- [x] OpenAI interface for OpenAI API. [Description](#openai-interface-extra-tab)
- [x] Google Maps api interface for visualizing vehicles from the Car service's API. [Description](#openai-interface-extra-tab)

Brand new React front-end, to integrate all previous solutions together, with several new external API integrations:

- [x] [New front-end](frontend/react-apiview-app/README.md) 
- [x] [Google maps](frontend/react-apiview-app/README.md#googlemaps)
- [x] [OpenAI](frontend/react-apiview-app/README.md#openai)
- [x] [Jira](frontend/react-apiview-app/README.md#jira)

### The Back-End

Features:

**1. Managing user access with Spring Security**

- Unauthorized users are restricted from accessing pages other than the login and signup pages.
- Custom handling of calls to the `/login` and `/logout` endpoints.
- Custom `AuthenticationProvider` which authorizes user logins by matching their credentials against those stored in the
  database.

**2. Handling front-end calls with controllers**

- Controllers for the application that bind application data and functionality to the front-end. Using Spring MVC's
  application model to identify the templates served for different requests and populating the view model with data
  needed by the template.
- Controllers also be responsible for determining what, if any, error messages the application displays to the user.
  When a controller processes front-end requests, it delegates the individual steps and logic of those requests to other
  services in the application, but it interprets the results to ensure a smooth user experience.

**3. Making calls to the database with MyBatis mappers**

- All entity classes match the database schema.sql.
- All entities have a MyBatis mapper interface in the mappers folder. They have methods that represent specific SQL
  queries and statements required by the functionality of the application. They support the basic CRUD operations for
  their respective models.

**4. Features of extra services**

- [Vehicles Service](vehicles-api/README.md).
- [Petstore Service](backend/petstore/README.md).
- [Cloudapp Service](cloudapp/README.md).

### The Front-End

There are HTML templates for the application pages. They have fields, modal forms, success and error message elements,
as well as styling and functional components using Bootstrap as a framework. They also have Thymeleaf attributes to
supply the back-end data and functionality described by the following individual page requirements:

**1. Login page**

- All users can access the page and only registered users are able to login to the application.
- Shows login errors, like invalid username/password, on this page.

**2. Sign Up page**

- All users can access the page and potential users can use this page to sign up for a new account.
- Shows signup errors on the page when they arise.
- Password is stored securely with hashing/salt.

**3. Home page**
The home page is the center of the application and hosts the three parts of base functionality plus the additional extra
layers:

I. Files (base functionality)</u>

- The user can upload files and see/download/delete any files they previously uploaded.
- Any errors related to file actions is displayed (no duplicates or empty/large files).
  Files: upload, view, delete.

![](frontend/examples/files.png)

II. Notes (base functionality)

- The user can create notes and see/edit/delete notes they have previously created. Size limit is 1000 character.

![](frontend/examples/notes.png)

III. Credentials (base functionality)

- The user can store credentials for specific websites and see/edit/delete the credentials they've previously stored.
- Passwords are displayed in encrypted form in the list, but upon editing they are able to see the unencrypted values.

![](frontend/examples/credentials.png)

IV. Cars (extra tab, optional)

- The user can do basic CRUD operations from the Cars tab, which uses [Vehicles service API interface](vehicles-api/README.md).
- Any errors related to the operations is displayed.

![](frontend/examples/cars.png)

V. Pets (extra tab, optional)

- The user can create owners, employees and pets and assign them a schedule from the Pets tab, which uses [Petstore
  service API interface](backend/petstore/README.md):.
- Any errors related to the operations is displayed.
- Order of usage:
  * add a new owner
  * assign a new pet to it
  * add a new employee
  * assign a schedule to it
  * add a schedule based on date, pet and employee and it's skill

![](frontend/examples/petstore.png)

VI. Cloudapp (extra tab, optional)

- The user can create cloudapp users, items, carts and orders for the [Cloudapp service](cloudapp/README.md): through its API.
- Any errors related to the operations is displayed.
- Order of usage:
  * add a new user, which then it is logged in to the Cloudapp system with a Bearer token.
  * Add optional items to the database, if needed.
  * Add items to the cart, clear or submit order, when it is done.
  * Check previous orders, if any, in the table.
  
![](frontend/examples/cloudapp.png)

### OpenAI interface (extra tab)

- The user can create OpenAI completition and Dall-E image generation via the OpenAI API.
- Order of usage:
  * Make sure to use your OpenAI key in openApiKey parameter in [application.properties](cloudinterface/src/main/resources/application.properties) ![](frontend/examples/OpenAI_0_apiKey.png)
  * Click Add a New OpenAI Completition request. This will initiate a completition request in the background. ![](frontend/examples/OpenAI_1_tab.png)
  * Fill out the text you want to use for completition.![](frontend/examples/OpenAI_2_input.png)
  * Upon Submit, you will get a response from OpenAI.![](frontend/examples/OpenAI_3_output.png)
  * The latest submission is always visible at the OpenAI request tab.![](frontend/examples/OpenAI_4_history.png)
  * Click Add a New OpenAI Image request. This will initiate a Dall-E request in the background. ![](frontend/examples/OpenAI_1_tab.png)
  * Fill out the text you want to use for image generation.![](frontend/examples/OpenAI_5_input.png)
  * Upon Submit, you will get an image response from OpenAI.![](frontend/examples/OpenAI_6_output.png)
  * The latest submission is always visible at the OpenAI request tab.![](frontend/examples/OpenAI_7_history.png)


### Testing

Selenium tests are defined to verify user-facing functionality and to check feature-completeness.

1. Tests for user signup, login, logout and unauthorized access restrictions.
2. Tests for note creation, viewing, editing, and deletion.
3. Tests for credential creation, viewing, password encryption, editing, and deletion.
4. Test for checking empty file upload.

## Dependencies

The project requires the use of Java 11 and Maven.

## Installing instructions

Check each component to see its details and instructions. Note that all applications should be running (start them in
reading order) at once for full operation. Either follow base of full functionality procedure.

1. Base functionality:

- [CloudInterface](cloudinterface/README.md): first main project of nanodegree program, when run alone, no Cars or Pets
  interface available.

2. Full functionality with base and extra layers:

- [Eureka](eureka/README.md): microservice registration and discovery.
- [Boogle Maps](boogle-maps/README.md): a mock service to simulate a backend for vehicle location.
- [Pricing Service](pricing-service/README.md): a mock service to simulate a backend for vehicle pricing.
- [Vehicles API](vehicles-api/README.md): second main project of nanodegree program. A REST API to maintain vehicle data
  and to provide a complete view of vehicle details including price and address.
- [Petstore](backend/petstore/README.md): third main project of nanodegree program. A REST API to maintain petstore data with
  pets, owners, employees and schedules.
- [Cloudapp](cloudapp/README.md): fourth main project of nanodegree program. A REST API to maintain cloudapp data
  with users, items, carts and orders.
- [CloudInterface](cloudinterface/README.md): first main project of nanodegree program, extended to communicate with the
  Vehicles API and send/receive data with it.

1. Compile and package application in each subfolder:

```
   mvn clean package
```

2. Eureka:

```
java -jar target/eureka-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 8761. Check interface: http://localhost:8761/

3. Boogle Maps:

```
java -jar target/boogle-maps-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 9191. You can check it on the command line by using.

```
curl http://localhost:9191/maps?lat=20.0&lon=30.0
```

4. Pricing Service:

```
java -jar target/pricing-service-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 8082. You can check it on the command line by using.

```
curl http://localhost:8082/services/price?vehicleId=1
```

5. Vehicles API:

```
java -jar target/vehicles-api-0.0.1-SNAPSHOT.jar
```

• Swagger API documentation is available at: http://localhost:8080/swagger-ui.html

6. Petstore:

```
java -jar target/petstore-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 8083. Check [README](backend/petstore/README.md) for Postman usage.

7. Cloudapp:

```
java -jar target/cloudapp-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 8099. Check [README](cloudapp/README.md) for Postman usage.

8. Cloud interface:

```
java -jar target/cloudinterface-0.0.1-SNAPSHOT.jar
```

• The service is available by default on port 8081. Check interface: http://localhost:8081/


