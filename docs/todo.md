# Pipeline Project — Master TODO

## Lectures

### Lecture 01 — CI/CD Pipeline Basics ✅
- ✅ index.html (educational content)
- ✅ quiz.html (60-question interactive quiz)
- ✅ `?` question system on all content blocks

### Lecture 02 — Environment Variables, Logging & Monitoring ✅
- ✅ index.html (educational content)
- ✅ quiz.html (60-question interactive quiz)
- ✅ `?` question system on all content blocks

#### Lecture 02 Sections
1. Intro — Environment Variables, Logging & Monitoring
2. Core Concepts (8 cards): Environment Variables, .env & dotenv, GitHub Secrets, Log Levels, Structured Logging, Central Logger Pattern, Health Check Endpoints, Code Coverage
3. Key Comparisons: .env vs GitHub Secrets, console.log vs Structured Logger, Statement Coverage vs Branch Coverage
4. How It Works — Animated Flow (pause/resume per step)
5. Code Explained — Line by Line
6. Flash Cards (37)
7. FAQ (13 items)

#### Lecture 02 Quiz Categories
- Environment Variables & dotenv
- GitHub Secrets & Production Config
- Logger Class & Log Levels
- Structured Logging & Security
- Error Handling & API Responses
- Health Checks & Coverage Reports

### Lecture 03 — Grafana Cloud, Loki & Log Shipping ✅
- ✅ index.html (educational content)
- ✅ quiz.html (60-question interactive quiz)
- ✅ `?` question system on all content blocks

#### Lecture 03 Sections
1. Intro — Grafana Cloud, Loki & Log Shipping
2. Core Concepts (8 cards): Observability, Grafana Cloud, Grafana Loki, Log Labels, Log Transport Modes, Loki Push API, Admin Dashboard, Structured Log Metadata
3. Key Comparisons: Local vs Direct vs Alloy, console.log vs Loki Logger, Pull-Based vs Push-Based Logging
4. How It Works — Animated Flow: Direct Push, Alloy Transport, Loki Query Flow
5. Code Explained — Line by Line (logger.js transport + Loki push, app.js admin routes)
6. Flash Cards (37)
7. FAQ (13 items)
8. Real Debugging Stories (10 items — actual issues hit during build)
9. Quick Reference Cheat Sheet (LogQL, transport modes, env vars, admin endpoints)

#### Lecture 03 Bonus
- ✅ bonusknowledgeAboutlogger.html — Deep-dive into logger.js internals
  - File structure anatomy (class diagram with public/private/const/export color coding)
  - 4 animated flows (log.info path, buffer flush → Loki, level filtering, stdout vs stderr)
  - 12 core concept cards (levels, transports, batching, ring buffer, singleton, unref, Basic Auth, nanoseconds, silent failure, JSON entries, destroy, dynamic protocol)
  - Full code walkthrough (42 explainer lines covering every method)
  - 35 flash cards
  - 20-question inline quiz
  - `?` question system on all content blocks

#### Lecture 03 Quiz Categories
- Grafana Cloud & Loki Basics
- Log Transport Modes
- Loki Push API & Authentication
- Labels, Metadata & LogQL
- Admin Dashboard & Metrics
- Security & Production Config

---

## Rules

### Rule 1 — Question Review Workflow
When asked, go through **all lectures**. If any page has saved user questions (localStorage), extend that page with a **Q&A section** containing answers to the saved questions, plus a new `?` field for follow-up questions.

### Rule 2 — New Lecture Checklist
Every new lecture must create the following, matching the existing pattern:
- `docs/lectureNN/index.html` — educational content (dark GitHub theme, single-file, CSS+JS inline)
- `docs/lectureNN/quiz.html` — interactive quiz (60 questions, multiple categories)
- `?` question system on **every** content block (concept cards, explainer lines, flashcards, FAQ items, tables, pipeline-viz)
- Update this `docs/todo.md` with the new lecture's sections and status
