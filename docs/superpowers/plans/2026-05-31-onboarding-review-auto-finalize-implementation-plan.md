# Onboarding Review Auto-Finalize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make onboarding review auto-save before sending, capture employer pre-sign data during send, show employer signature to employees before signing, and auto-finalize the contract after employee signature.

**Architecture:** Extend the existing contract workflow instead of replacing it. Reuse the existing employer signature fields on the contract model, add a small pre-sign save path in contract service, and make employee signing auto-finalize when employer pre-sign data already exists. Update onboarding review to collect and validate employer signing inputs in the existing final review card.

**Tech Stack:** React 19, TypeScript, Vitest, Spring Boot, Java, JUnit 5, existing contract-service PDF generator and frontend user-service API layer

---

### Task 1: Backend auto-finalize workflow

**Files:**
- Modify: `Program/microservice/contract-service/src/main/java/com/pm/contractservice/service/ContractService.java`
- Modify: `Program/microservice/contract-service/src/main/java/com/pm/contractservice/controller/ContractController.java`
- Modify: `Program/microservice/contract-service/src/test/java/com/pm/contractservice/service/ContractServiceSignContractTest.java`
- Modify: `Program/microservice/contract-service/src/test/java/com/pm/contractservice/service/ContractServiceSendContractTest.java`

- [ ] Add failing tests for storing employer pre-sign data on a draft/sent contract and for auto-finalizing when employee signing happens after pre-sign exists.
- [ ] Run the focused contract-service tests and verify the new tests fail for the expected missing behavior.
- [ ] Add a backend service/controller path that stores employer pre-sign audit fields without finalizing the contract.
- [ ] Update employee signing so it finalizes immediately when valid employer pre-sign data exists and still keeps the old manual finalize path as fallback.
- [ ] Re-run the focused contract-service tests and verify they pass.

### Task 2: Frontend contract API and onboarding review logic

**Files:**
- Modify: `Program/frontend/src/services/user-service/GetContracts.ts`
- Modify: `Program/frontend/src/services/user-service/UserServices.ts`
- Modify: `Program/frontend/src/pages/AdminOnboardingReviewDetails.tsx`
- Modify: `Program/frontend/src/pages/AdminOnboardingReviewDetails.test.tsx`

- [ ] Add failing frontend tests for employer pre-sign validation and for the create-and-send helper path automatically saving the review before sending.
- [ ] Run the focused onboarding review tests and verify the new tests fail for the expected missing behavior.
- [ ] Extend the frontend contract API with a pre-sign request shape and service call.
- [ ] Add employer agreement, typed name, optional drawn signature, and clear-signature behavior to the onboarding review final card.
- [ ] Update create-and-send so it saves the review first, saves or updates the draft, stores employer pre-sign data, then sends the contract.
- [ ] Re-run the focused onboarding review tests and verify they pass.

### Task 3: Employee contract preview and signing

**Files:**
- Modify: `Program/frontend/src/pages/AccountContractSign.tsx`
- Modify: `Program/frontend/src/pages/AccountContractSign.test.tsx`
- Modify: `Program/microservice/contract-service/src/main/java/com/pm/contractservice/service/pdf/ContractPdfGenerator.java`

- [ ] Add failing tests proving the employee contract preview renders employer signature information when pre-sign data exists.
- [ ] Run the focused preview test and verify it fails for the expected missing employer display.
- [ ] Update the React contract preview to show employer signature/name details before employee sign.
- [ ] Update PDF generation so sent or signed contracts can render stored employer signature details before full finalization while finalized PDFs remain locked.
- [ ] Re-run the focused preview/backend tests and verify they pass.

### Task 4: Verification, rundown, and finish

**Files:**
- Modify: `Project Plan/Rundown/ParadePaardRundown.tex`

- [ ] Run all focused frontend and backend tests touched by the feature.
- [ ] Run any practical build or compile checks that are not already broken by unrelated workspace issues, and record any unrelated failures honestly.
- [ ] Update the rundown with the visible onboarding review and contract-signing behavior changes plus a new top change-log entry dated `2026 05 31`.
- [ ] Commit with a feature-specific message and push the completed work.
