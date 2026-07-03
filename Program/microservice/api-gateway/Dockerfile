FROM maven:3.9.10-eclipse-temurin-21 AS builder
WORKDIR /app

COPY pom.xml ./
RUN mvn -B dependency:go-offline

COPY src ./src
# build the boot jar and skip tests so the jar is always created
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre AS runner
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# copy the single boot jar from target to a fixed name
COPY --from=builder /app/target/*.jar /app/app.jar

EXPOSE 4006
ENTRYPOINT ["java","-jar","/app/app.jar"]
