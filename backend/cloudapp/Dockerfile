FROM docker.io/library/maven:3-eclipse-temurin-21 AS builder

COPY src /home/root/src
COPY pom.xml /home/root/pom.xml

ARG DOCKER_HOST_IP
ENV DOCKER_HOST_IP=host.docker.internal

WORKDIR /home/root
RUN mvn package

FROM eclipse-temurin:21-jdk-alpine AS run

RUN mkdir -p /home/run
WORKDIR /home/run
COPY --from=builder /home/root/target/cloudapp-0.0.1-SNAPSHOT.jar /home/run/cloudapp-0.0.1-SNAPSHOT.jar

ARG DOCKER_HOST_IP
ENV DOCKER_HOST_IP=host.docker.internal

ENTRYPOINT ["java", "-jar", "/home/run/cloudapp-0.0.1-SNAPSHOT.jar"]