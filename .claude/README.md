# PDI HolmesGPT — `.claude/` Reference

Claude Code configuration for the **PDI HolmesGPT** repository. Contains skills, commands, and an agent for the full development lifecycle.

## Quick Start

| I want to… | Run |
|---|---|
| Deploy a new version to dev | `/ship` |
| Check if the deployment is healthy | `/check-deployment` |
| Investigate an alert or incident | `/investigate-alert <description>` |
| Add a new toolset or MCP integration | `/add-integration` |
| Build a React UI feature | `/build-ui-feature` |
| Create a new built-in toolset | `/create-toolset` |
| Manage projects / tag filters | `/manage-projects` |
| Run linting checks | `/linting` |

## Folder Structure

```
.claude/
├── SKILL-INDEX.md              ← Master index: all skills, triggers, compositions
├── plugin.json                 ← Plugin metadata
├── README.md                   ← This file
│
├── agents/
│   └── holmesgpt-pdi-engineer.md   ← PDI platform engineer agent
│
├── commands/                   ← Slash commands (quick-reference entry points)
│   ├── ship.md                 ← Build + push + deploy to dev
│   ├── check-deployment.md     ← Health check the live deployment
│   ├── investigate-alert.md    ← Run an investigation via the API
│   ├── add-integration.md      ← Add toolset or MCP server
│   ├── create-toolset.md       ← Build a new built-in toolset
│   ├── build-ui-feature.md     ← React frontend development
│   ├── manage-projects.md      ← Projects API quick reference
│   └── linting.md              ← Run pre-commit / ruff / mypy
│
└── skills/                     ← Deep-dive skill documentation
    ├── deploy-to-aws/          ← Full deploy workflow (ECR + EKS + OpenTofu)
    ├── debug-deployment/       ← Systematic deployment debugging
    ├── triage-aws-incident/    ← AWS incident investigation patterns
    ├── add-toolset/            ← Built-in toolset development guide
    ├── add-mcp-server/         ← MCP server integration guide
    ├── design-ui/              ← React + PDI design system guide
    ├── manage-projects/        ← Projects architecture + DynamoDB schema
    └── create-eval/            ← LLM evaluation test authoring guide
```

## Commands

| Command | Description | Primary Skill |
|---|---|---|
| `/ship` | Build Docker image, push to ECR, run `tofu apply`, verify rollout | `deploy-to-aws` |
| `/check-deployment` | Health endpoints, pod status, integration status, recent logs | `debug-deployment` |
| `/investigate-alert` | Authenticate + POST to `/api/chat`, stream investigation results | `triage-aws-incident` |
| `/add-integration` | Determine type (MCP vs built-in), implement, test, deploy | `add-mcp-server` / `add-toolset` |
| `/create-toolset` | Scaffold Python toolset, register, write tests, lint | `add-toolset` |
| `/build-ui-feature` | React component, PDI design system, API wiring, deploy | `design-ui` |
| `/manage-projects` | Create/list/debug projects, tag filters, instance preview | `manage-projects` |
| `/linting` | Run `pre-commit run -a` (only when explicitly asked) | — |

## Skills

| Skill | When to Load |
|---|---|
| `deploy-to-aws` | Any deployment task — ECR push, `tofu apply`, rollout verification |
| `debug-deployment` | Pod issues, health check failures, integration errors, config problems |
| `triage-aws-incident` | AWS alarm fired, ECS/Lambda/RDS incident, CloudWatch investigation |
| `add-toolset` | Adding a new built-in Python or YAML toolset to Holmes |
| `add-mcp-server` | Integrating an MCP server (stdio, SSE, or HTTP transport) |
| `design-ui` | React frontend work — new components, PDI design system, API wiring |
| `manage-projects` | Projects CRUD, tag-filter instances, DynamoDB schema, troubleshooting |
| `create-eval` | Writing LLM evaluation tests with K8s or cloud infrastructure |

## Environment

```
App URL:      https://holmesgpt.dev.platform.pditechnologies.com
Auth:         admin / HolmesGPT@Dev2026!
ECR:          717423812395.dkr.ecr.us-east-1.amazonaws.com/holmesgpt
EKS:          holmesgpt-dev  (us-east-1, namespace: holmesgpt)
DynamoDB:     holmesgpt-dev-config
AWS Profile:  pdi-platform-dev
Tofu:         ~/.local/bin/tofu  (NOT terraform)
```

## CI Pipeline

All PRs run `.github/workflows/pdi-lint.yaml` — 6 parallel shift-left jobs:

| Job | Tools |
|---|---|
| `python-lint` | ruff format, ruff lint, isort, mypy |
| `python-sast` | bandit (HIGH severity), pip-audit CVEs |
| `frontend-lint` | tsc --noEmit, ESLint (0 warnings), npm audit |
| `iac-scan` | Checkov on `infra/*.tf` |
| `secrets-scan` | Gitleaks (full git history) |
| `container-scan` | Trivy CRITICAL/HIGH vulns + secrets in image |

See `CLAUDE.md § PDI CI Pipeline` for full operational notes.
