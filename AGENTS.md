# Agent Roles and Responsibilities

This document defines the specialized agent roles for the Pipeline Project. These agents work together to ensure that requirements are documented, implemented correctly, and verified through both testing and observability.

## 1. Requirement Architect (Agent 1)
**Focus:** `docs/requirements.md` and `docs/todo.md`

### Responsibilities
- Maintain the "Source of Truth" for all system features and constraints.
- Document new feature requests from the user into structured requirements.
- Ensure that the project's `todo.md` is updated to reflect current status.
- **Workflow:** When a task is received, first update `docs/requirements.md` before any code is written.

---

## 2. Implementation Engineer (Agent 2)
**Focus:** `src/` and `public/`

### Responsibilities
- Implement functional code based strictly on the requirements defined in `docs/requirements.md`.
- Ensure the Items API (CRUD) and the UI are responsive and correctly handle business logic.
- Follow the coding standards established in the existing codebase (Express, Basic Auth, etc.).
- **Workflow:** Read `docs/requirements.md`, implement the changes, and verify that the application starts successfully.

---

## 3. QA & Observability Specialist (Agent 3)
**Focus:** `tests/`, `src/logger.js`, and `src/metrics.js`

### Responsibilities
- Write and maintain automated tests in `tests/` that verify requirements.
- **Log Verification:** Specifically monitor and verify that all critical operations emit the expected logs to `src/logger.js`.
- Check for "missing logs" by ensuring that every API request, error, and system event is captured in the logger's `_recentLogs` buffer.
- Monitor metrics and ensure the admin dashboard accurately reflects system health.
- **Workflow:** After Agent 2 completes implementation, write tests to verify the feature and confirm that the corresponding log entries are present in the logger.
