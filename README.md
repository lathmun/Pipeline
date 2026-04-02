# Pipeline Project

A Node.js application with a CI/CD pipeline for safe deployment.

## Quick Start

```bash
npm install
npm start        # Start server at http://localhost:5000
npm test         # Run test suite
```

**Login credentials:** `admin` / `password123`

## Pages

- `http://localhost:5000` — Items Manager (main app)
- `http://localhost:5000/checklist.html` — Pipeline setup checklist

## API Endpoints

All endpoints require Basic Authentication.

| Method | Path              | Description       |
|--------|-------------------|-------------------|
| GET    | `/api/items`      | List all items    |
| GET    | `/api/items/:id`  | Get single item   |
| POST   | `/api/items`      | Create an item    |
| PUT    | `/api/items/:id`  | Update an item    |
| DELETE | `/api/items/:id`  | Delete an item    |

## Branching & Deployment Workflow

```
test branch  ──push──> CI runs tests ──pass──> Auto-deploy to test server
                                                       │
                                              Manual testing on test server
                                                       │
                                              Create PR: test → master
                                                       │
                                              PR tests pass + review
                                                       │
                                                 Merge to master
```

### Rules

1. **No direct pushes to `master`** — the branch is protected.
2. Developers push to the `test` branch.
3. On push to `test`, GitHub Actions runs all tests. If they pass, the app is deployed to the test server.
4. After manual testing on the test server, create a PR from `test` → `master`.
5. The PR triggers another test run. After tests pass and the PR is approved, it can be merged.

### Setting Up Branch Protection on GitHub

1. Go to **Settings → Branches** in your GitHub repository.
2. Click **Add rule** for the `master` branch.
3. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging** (select the "Run Tests" check)
   - ✅ **Do not allow bypassing the above settings**
4. Save the rule.

## Project Structure

```
├── .github/workflows/
│   ├── test-branch.yml    # CI/CD for test branch (test + deploy)
│   └── pr-master.yml      # CI for PRs to master (test only)
├── public/
│   ├── index.html         # Main app UI
│   └── checklist.html     # Pipeline setup todo checklist
├── src/
│   ├── app.js             # Express app (routes, auth, logic)
│   └── server.js          # Server entry point
├── tests/
│   └── app.test.js        # API tests (jest + supertest)
├── package.json
└── README.md
```
