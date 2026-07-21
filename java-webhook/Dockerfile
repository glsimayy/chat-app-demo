# syntax=docker/dockerfile:1

FROM maven:3.9.11-eclipse-temurin-17-alpine AS build
WORKDIR /workspace

COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    mvn --batch-mode --no-transfer-progress dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn --batch-mode --no-transfer-progress package

FROM eclipse-temurin:17-jre-alpine AS runtime
RUN addgroup -S ello && adduser -S -G ello ello

WORKDIR /app
COPY --from=build --chown=ello:ello \
    /workspace/target/ello-java-webhook-*.jar /app/app.jar

USER ello
EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
