# PDI HolmesGPT — Skill Index

This index maps every skill in `.claude/skills/` to its trigger condition and links to the corresponding command (if one exists).

## Skills

| # | Skill | Trigger / When to Use | Command |
|---|---|---|---|
| 1 | [deploy-to-aws](skills/deploy-to-aws/SKILL.md) | Build Docker image, push to ECR, run `tofu apply`, verify rollout | `/ship` |
| 2 | [debug-deployment](skills/debug-deployment/SKILL.md) | Pod crashlooping, health endpoints failing, integration errors, config issues | `/check-deployment` |
| 3 | [triage-aws-incident](skills/triage-aws-incident/SKILL.md) | AWS alarm fired, ECS/Lambda/RDS incident, CloudWatch investigation | `/investigate-alert` |
| 4 | [add-toolset](skills/add-toolset/SKILL.md) | Add a new built-in toolset (Python or YAML), register with Holmes | `/create-toolset` |
| 5 | [add-mcp-server](skills/add-mcp-server/SKILL.md) | Integrate an MCP server (stdio/SSE/HTTP), configure per-project scoping | `/add-integration` |
| 6 | [design-ui](skills/design-ui/SKILL.md) | Build or modify React frontend components, follow PDI design system | `/build-ui-feature` |
| 7 | [manage-projects](skills/manage-projects/SKILL.md) | Create/update/debug Projects, tag-filter instances, DynamoDB schema | `/manage-projects` |
| 8 | [create-eval](skills/create-eval/SKILL.md) | Write LLM evaluation tests, set up K8s/cloud infrastructure, anti-hallucination patterns | — |

---

## Skill Compositions for Common Tasks

### 1. Ship a New Feature End-to-End
> Build → push → deploy → verify

**Skills used (in order):**
1. `design-ui` — implement the React component
2. `deploy-to-aws` — build image, push to ECR, apply OpenTofu
3. `debug-deployment` — verify health after rollout

**Command:** `/ship` (covers steps 2–3)

---

### 2. Add a New Integration
> Determine type → implement → test → deploy

**Skills used (in order):**
1. `add-toolset` — if it's a built-in Python/YAML toolset
   **OR** `add-mcp-server` — if it's an MCP server
2. `deploy-to-aws` — deploy the updated image
3. `debug-deployment` — verify integration status post-deploy

**Command:** `/add-integration` (covers step 1), `/ship` (covers steps 2–3)

---

### 3. Investigate a Live Incident
> Authenticate → stream investigation → report findings

**Skills used:**
1. `triage-aws-incident` — AWS-specific investigation patterns
2. `debug-deployment` — if the issue is with HolmesGPT itself

**Command:** `/investigate-alert`

---

### 4. Write an Eval Test for a New Toolset
> Create test_case.yaml → set up infrastructure → run → verify

**Skills used (in order):**
1. `add-toolset` or `add-mcp-server` — implement the toolset first
2. `create-eval` — write the LLM evaluation test

**Command:** `/create-toolset` (step 1)

---

### 5. Debug a Broken Deployment
> Health check → pod logs → integration status → fix

**Skills used:**
1. `debug-deployment` — systematic diagnosis
2. `deploy-to-aws` — re-deploy after fix

**Command:** `/check-deployment` (diagnosis), `/ship` (re-deploy)

---

## Command → Skill Mapping

| Command | Primary Skill(s) |
|---|---|
| `/ship` | `deploy-to-aws` |
| `/check-deployment` | `debug-deployment` |
| `/investigate-alert` | `triage-aws-incident` |
| `/create-toolset` | `add-toolset` |
| `/add-integration` | `add-mcp-server`, `add-toolset` |
| `/build-ui-feature` | `design-ui` |
| `/manage-projects` | `manage-projects` |
| `/linting` | *(inline — no dedicated skill)* |
