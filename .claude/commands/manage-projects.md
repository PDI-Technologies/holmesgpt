Create, update, or debug HolmesGPT Projects — named groups of integration instances that scope AI triage to a specific team or environment.

$ARGUMENTS

Use the `manage-projects` skill for full reference on the Projects feature.

## Quick Actions

### Create a project via API

```bash
# Login first
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF
curl -s -c /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

# Create project
cat > /tmp/project.json << 'EOF'
{
  "name": "My Team",
  "description": "My team's integrations",
  "instances": [
    {
      "type": "grafana/dashboards",
      "name": "grafana-myteam",
      "secret_arn": "arn:aws:secretsmanager:us-east-1:<AWS_ACCOUNT_ID>:secret:holmesgpt-dev/project-grafana-myteam"
    },
    {
      "type": "aws_api",
      "name": "aws_api",
      "secret_arn": null,
      "aws_accounts": ["myteam-prod", "myteam-dev"]
    },
    {
      "type": "ado",
      "name": "ado",
      "secret_arn": null
    }
  ]
}
EOF
curl -s -b /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/api/projects \
  -H "Content-Type: application/json" -d @/tmp/project.json | python3 -m json.tool
```

### List all projects

```bash
curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/projects \
  | python3 -c "import sys,json; [print(p['name'], '-', len(p['instances']), 'instances') for p in json.load(sys.stdin)['projects']]"
```

### Create a per-project secret in Secrets Manager

```bash
# Grafana secret
aws secretsmanager create-secret \
  --name "holmesgpt-dev/project-grafana-myteam" \
  --secret-string '{"api_url":"https://grafana-myteam.pdisoftware.com","api_key":"glsa_xxxx"}' \
  --profile <AWS_PROFILE> --region us-east-1

# MCP (ADO/Atlassian/Salesforce) secret
aws secretsmanager create-secret \
  --name "holmesgpt-dev/project-ado-myteam" \
  --secret-string '{"api_key":"your-per-team-api-key"}' \
  --profile <AWS_PROFILE> --region us-east-1
```

## Debugging

If a project isn't working, use the `debug-deployment` skill → **Projects API Debugging** section.

Common issues:
- `Project not found` — project_id doesn't exist in DynamoDB
- `Failed to build project executor` — check pod logs: `kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=100 | grep -i "project\|toolset\|secret"`
- `Secret has no api_key field` — MCP secret must be `{"api_key": "..."}`
- AWS accounts not filtering — verify account names match exactly what's in `logistics_accounts` Terraform variable
