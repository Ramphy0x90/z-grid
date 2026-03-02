FROM eclipse-temurin:25-jdk AS builder
WORKDIR /app

COPY gradlew gradlew
COPY gradle gradle
COPY settings.gradle build.gradle ./
COPY src src

RUN chmod +x ./gradlew && \
    attempts=0; \
    until [ "$attempts" -ge 3 ]; do \
      ./gradlew clean bootJar --no-daemon && break; \
      attempts=$((attempts + 1)); \
      echo "Gradle build failed (attempt ${attempts}/3), retrying in 10s..."; \
      sleep 10; \
    done; \
    [ "$attempts" -lt 3 ]

FROM eclipse-temurin:25-jdk
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
