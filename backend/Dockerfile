FROM gradle:9.3.0-jdk25 AS builder
WORKDIR /home/gradle/src

COPY --chown=gradle:gradle settings.gradle build.gradle ./

RUN --mount=type=cache,target=/home/gradle/.gradle \
    gradle --no-daemon help

COPY --chown=gradle:gradle src src

RUN --mount=type=cache,target=/home/gradle/.gradle \
    gradle bootJar --no-daemon

FROM eclipse-temurin:25-jdk
WORKDIR /app

COPY --from=builder /home/gradle/src/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
