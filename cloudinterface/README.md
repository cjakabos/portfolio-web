# Cloud Interface

Personal information management application, and the minimum viable product includes three storage features:

1. **Simple File Storage:** Upload/download/remove files
2. **Note Management:** Add/update/remove text notes
3. **Password Management:** Save, edit, and delete website credentials.

Complete solution for a back-end server, front-end website, and tests. For details see main [README](../README.md).

Additional features are available, when the other services are also running, check main [README](../README.md) for
details.

## Run the code

To run this service you execute:

```
mvn clean package
```

```
java -jar target/cloudinterface-0.0.1-SNAPSHOT.jar
```

IMPORTANT NOTE: when running the service in standalone mode, only the base 3 features are working, as the remaining
services are dependent on the other services. For usage of those services check main [README](..\README.md).