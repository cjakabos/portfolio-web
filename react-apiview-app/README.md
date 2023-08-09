# Getting Started with Create React App

## Required api services

In the repository start these 3 services in different terminals:

eCommerce api:
```
cd ecommerce
mvn clean package
java -jar target/ecommerce-0.0.1-SNAPSHOT.jar
```

Vehicles api:
```
cd vehicles-api
mvn clean package
java -jar target/vehicles-api-0.0.1-SNAPSHOT.jar
```

Pet Store api:
```
Install msql, eg. on mac:
brew install mysql
brew services start mysql

Start mysql and flush privileges, if issues arise:
mysql -u root    
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY ‘root’;

start the service from repo root:
cd petstore
mvn clean package
java -jar target/petstore-0.0.1-SNAPSHOT.jar
```

Start React front-end
### `npm start`

Runs the app in the development mode.\
Open [http://localhost:5001](http://localhost:5001) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

If everything is correctly started, you should see a login page:
![](../examples/react1.png)

And you should be able to log in, and see the current front-end of the api integrations from the services above:
![](../examples/react2.png)


