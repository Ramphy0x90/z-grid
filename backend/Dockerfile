FROM gradle:9.3.0-jdk25 AS builder
WORKDIR /home/gradle/src

COPY --chown=gradle:gradle settings.gradle build.gradle ./

RUN --mount=type=cache,target=/home/gradle/.gradle \
    printf '%s\n' \
      'allprojects {' \
      '    tasks.register("resolveAllDeps") {' \
      '        doLast {' \
      '            configurations.findAll { it.canBeResolved }.each { it.resolve() }' \
      '        }' \
      '    }' \
      '}' > /tmp/resolve-deps.init.gradle && \
    attempts=0; \
    until [ "$attempts" -ge 4 ]; do \
      gradle --no-daemon -I /tmp/resolve-deps.init.gradle --refresh-dependencies resolveAllDeps && break; \
      attempts=$((attempts + 1)); \
      echo "Dependency resolution failed (attempt ${attempts}/4), retrying in 15s..."; \
      sleep 15; \
    done; \
    [ "$attempts" -lt 4 ]

COPY --chown=gradle:gradle src src

RUN --mount=type=cache,target=/home/gradle/.gradle \
    gradle --no-daemon --offline bootJar || \
    (attempts=0; \
    until [ "$attempts" -ge 3 ]; do \
      gradle --no-daemon bootJar && break; \
      attempts=$((attempts + 1)); \
      echo "bootJar failed (attempt ${attempts}/3), retrying in 15s..."; \
      sleep 15; \
    done; \
    [ "$attempts" -lt 3 ])

FROM eclipse-temurin:25-jdk
WORKDIR /app

COPY --from=builder /home/gradle/src/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
