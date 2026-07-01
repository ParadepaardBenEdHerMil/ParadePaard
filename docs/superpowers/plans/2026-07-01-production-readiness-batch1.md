# Production Readiness Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten audit-log integrity, prove safe HTTP/grpc error contracts, and add contract tests for the existing auth Kafka event and user gRPC profile payloads.

**Architecture:** Keep changes narrow and behavior-preserving for legitimate flows. Add focused tests first, then the minimum production changes needed to make the tests pass without broad refactors.

**Tech Stack:** Spring Boot, JUnit 5, Mockito, MockMvc, gRPC Java, Kafka protobuf events, Maven.

---

### Task 1: Audit Log Integrity

**Files:**
- Modify: `Program/microservice/user-service/src/test/java/com/pm/userservice/AuditLogControllerSecurityTest.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/controller/AuditLogController.java`
- Test: `Program/microservice/user-service/src/test/java/com/pm/userservice/AuditLogControllerSecurityTest.java`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the targeted user-service controller test to verify the failure**
- [ ] **Step 3: Implement the minimum controller guard**
- [ ] **Step 4: Re-run the targeted test to verify it passes**

### Task 2: Safe Error Bodies

**Files:**
- Add: `Program/microservice/user-service/src/test/java/com/pm/userservice/GlobalExceptionHandlerTest.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/exception/GlobalExceptionHandler.java`
- Test: `Program/microservice/user-service/src/test/java/com/pm/userservice/GlobalExceptionHandlerTest.java`

- [ ] **Step 1: Write failing tests for upstream/raw error sanitization**
- [ ] **Step 2: Run the targeted test to verify the failure**
- [ ] **Step 3: Implement safe message sanitization**
- [ ] **Step 4: Re-run the targeted test to verify it passes**

### Task 3: Inter-service Contract Tests

**Files:**
- Add: `Program/microservice/auth-service/src/test/java/com/pm/authservice/kafka/KafkaProducerContractTest.java`
- Add: `Program/microservice/user-service/src/test/java/com/pm/userservice/grpc/UserGrpcServiceContractTest.java`
- Test: `Program/microservice/auth-service/src/test/java/com/pm/authservice/kafka/KafkaProducerContractTest.java`
- Test: `Program/microservice/user-service/src/test/java/com/pm/userservice/grpc/UserGrpcServiceContractTest.java`

- [ ] **Step 1: Write failing contract tests for Kafka producer payload and gRPC user payload**
- [ ] **Step 2: Run each targeted test to verify the expected failures**
- [ ] **Step 3: Implement only if a contract mismatch is exposed**
- [ ] **Step 4: Re-run the targeted tests to verify they pass**

### Task 4: Verification and Git

**Files:**
- Modify: only files touched by Tasks 1-3

- [ ] **Step 1: Run the full `user-service` test suite**
- [ ] **Step 2: Run the full `auth-service` test suite**
- [ ] **Step 3: Stage only intended source/test/doc files**
- [ ] **Step 4: Commit with a batch-specific message**
- [ ] **Step 5: Push `feature/production-readiness-tests`**
