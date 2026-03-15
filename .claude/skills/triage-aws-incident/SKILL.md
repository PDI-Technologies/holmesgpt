# Skill: triage-aws-incident

Investigate and triage incidents for applications deployed on AWS using HolmesGPT.

## Triage Philosophy

HolmesGPT uses a **five-whys agentic loop**: it calls tools, reads results, forms hypotheses, and drills deeper until it finds the root cause. Your job is to give it the right context and toolsets — it does the investigation.

**Effective triage = right question + right toolsets enabled.**

---

## Step 1: Identify What's Failing

Before asking Holmes, gather the minimal context:

| Signal | Where to find it |
|---|---|
| CloudWatch alarm name | AWS Console → CloudWatch → Alarms |
| Affected service | ECS service name, Lambda function, EC2 instance ID |
| Namespace / environment | Kubernetes namespace or ECS cluster |
| Time of first failure | CloudWatch alarm state change time |
| Error rate / metric | The metric that triggered the alarm |

---

## Step 2: Choose Your Investigation Mode

### Mode A: Free-form Chat (fastest for ad-hoc)

```bash
holmes ask "The payment-service ECS task is restarting every 5 minutes in us-east-1. \
  The CloudWatch alarm PaymentServiceErrorRate fired at 14:32 UTC. \
  What is causing the restarts and what should I do?"
```

### Mode B: AlertManager Integration (for automated pipelines)

If you have Prometheus AlertManager forwarding alerts:

```bash
# Port-forward AlertManager
kubectl port-forward svc/alertmanager 9093:9093 -n monitoring

# Investigate all firing alerts
holmes investigate alertmanager --alertmanager-url http://localhost:9093

# Investigate specific alert
holmes investigate alertmanager \
  --alertmanager-url http://localhost:9093 \
  --alertmanager-alertname "ECSTaskRestartingFrequently"

# Filter by severity
holmes investigate alertmanager \
  --alertmanager-url http://localhost:9093 \
  --alertmanager-label "severity=critical"
```

### Mode C: HTTP API with SSE Streaming (for the custom UI)

```javascript
// Real-time streaming investigation via the deployed UI backend
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ask: "Why is the payment-service failing?",
    stream: true,
    conversation_history: []
  })
});

// Handle SSE events
const reader = response.body.getReader();
// Events: start_tool_calling, tool_calling_result, ai_message, ai_answer_end
```

---

## Step 3: Enable the Right Toolsets

For AWS application triage, enable these toolsets in `~/.holmes/config.yaml`:

```yaml
# Minimum viable AWS triage setup
toolsets:
  kubernetes/core:
    enabled: true
  kubernetes/logs:
    enabled: true
  prometheus/metrics:
    enabled: true
    config:
      prometheus_url: http://prometheus-server.monitoring.svc:9090
  bash:
    enabled: true
    config:
      builtin_allowlist: extended

# AWS API access via MCP (read-only)
mcp_servers:
  aws_api:
    description: "AWS API - EC2, RDS, ELB, CloudWatch, CloudTrail, Lambda"
    config:
      mode: stdio
      command: uvx
      args: ["awslabs.aws-api-mcp-server@latest"]
      env:
        AWS_REGION: "us-east-1"
        AWS_PROFILE: "<AWS_PROFILE>"
        READ_OPERATIONS_ONLY: "true"
    llm_instructions: |
      Use this to query any AWS service API.
      Always check CloudTrail for recent changes when investigating failures.
      For ECS: describe-services, describe-tasks, describe-task-definition
      For RDS: describe-db-instances, describe-events, describe-db-log-files
      For Lambda: get-function, list-event-source-mappings, get-function-event-invoke-config
      For ELB: describe-target-health, describe-load-balancers
      For CloudWatch: get-metric-statistics, describe-alarms, get-log-events
      For CloudTrail: lookup-events (last 24h for recent changes)
```

For Grafana/Loki/Tempo (if deployed):
```yaml
toolsets:
  grafana/loki:
    enabled: true
    config:
      api_url: http://grafana.monitoring.svc:3000
      grafana_datasource_uid: loki-uid
  grafana/tempo:
    enabled: true
    config:
      api_url: http://grafana.monitoring.svc:3000
      grafana_datasource_uid: tempo-uid
  grafana/dashboards:
    enabled: true
    config:
      api_url: http://grafana.monitoring.svc:3000
```

---

## Step 4: AWS-Specific Investigation Patterns

### ECS Task Failures

```
"The ECS service payment-service in cluster prod-cluster is showing TaskStopped events.
Tasks are stopping with exit code 137 (OOM). The service has been running for 6 months
without issues. What changed and what is the root cause?"
```

Holmes will:
1. Call `kubectl_describe` on the ECS service (if using ECS+K8s)
2. Call AWS API to `describe-tasks` and `describe-services`
3. Check CloudTrail for recent task definition changes
4. Query CloudWatch for memory metrics
5. Check application logs for OOM patterns

### RDS Connection Failures

```
"The checkout-api pods in namespace production are failing with 'too many connections'
errors to the RDS PostgreSQL instance db-prod-checkout. The error started at 15:00 UTC.
Investigate the root cause."
```

Holmes will:
1. Check pod logs for connection error details
2. Query Prometheus for connection pool metrics
3. Call AWS API to check RDS `max_connections` parameter
4. Check CloudWatch RDS `DatabaseConnections` metric
5. Look for recent parameter group changes in CloudTrail

### Lambda Timeout / Throttling

```
"The order-processor Lambda function is being throttled and some orders are being lost.
The function processes SQS messages from the order-queue. Investigate why throttling
is happening and what the impact is."
```

### ALB / Target Group Health

```
"The ALB target group for the user-service has 3 out of 5 targets marked unhealthy.
The health check path is /health. Investigate why targets are failing health checks."
```

### EKS Node Issues

```
"Several pods in the production namespace are in Pending state. The nodes appear to
have resource pressure. Investigate what is consuming resources and why pods cannot
be scheduled."
```

---

## Step 5: Write Custom Runbooks for Your AWS Services

Runbooks guide Holmes to follow your team's specific investigation procedures.

Create `~/.holmes/runbooks/aws/`:

### `ecs-task-failure.md`

```markdown
# ECS Task Failure Investigation

## Goal
Determine why ECS tasks are stopping and provide remediation steps.

## Workflow
1. Get the ECS service details: cluster name, service name, desired/running count
2. List recent stopped tasks and their stop reasons (StopCode, StoppedReason)
3. Check the task definition for recent changes via CloudTrail
4. Examine CloudWatch logs for the stopped tasks (last 100 lines)
5. Check CloudWatch metrics: CPUUtilization, MemoryUtilization for the service
6. Check if the ALB target group shows the tasks as unhealthy
7. Check if there are any recent deployments (ECS deployment events)

## Synthesize Findings
Identify: Was this a code change, config change, resource exhaustion, or external dependency failure?

## Recommended Remediation Steps
- OOM (exit 137): Increase task memory limit or fix memory leak
- Exit code 1 (app crash): Check application logs for exception
- Health check failure: Verify /health endpoint and dependencies
- Resource exhaustion: Scale out service or optimize resource usage
```

### `rds-connection-exhaustion.md`

```markdown
# RDS Connection Exhaustion

## Goal
Diagnose why RDS is running out of connections and restore service.

## Workflow
1. Get current RDS instance details: instance class, max_connections parameter
2. Check CloudWatch DatabaseConnections metric (last 1 hour, 1-minute resolution)
3. Check which applications are connecting (check pg_stat_activity if accessible)
4. Look for recent changes: parameter group, instance class, application deployments
5. Check if connection pooling (PgBouncer/RDS Proxy) is configured
6. Identify which pods/services have the most connections

## Synthesize Findings
Root cause is usually: connection pool misconfiguration, missing connection pooling,
application bug holding connections, or sudden traffic spike.

## Recommended Remediation Steps
- Immediate: Restart pods with connection leaks
- Short-term: Enable RDS Proxy or PgBouncer
- Long-term: Implement connection pool limits per service
```

Configure runbooks:
```yaml
# ~/.holmes/config.yaml
custom_runbook_catalogs:
  - /home/user/.holmes/runbooks/aws/catalog.json
```

```json
// catalog.json
{
  "catalog": [
    {
      "id": "ecs-task-failure",
      "update_date": "2026-03-12",
      "description": "ECS task stopping unexpectedly - exit codes, OOM, health check failures",
      "link": "ecs-task-failure.md"
    },
    {
      "id": "rds-connection-exhaustion",
      "update_date": "2026-03-12",
      "description": "RDS PostgreSQL/MySQL running out of connections",
      "link": "rds-connection-exhaustion.md"
    }
  ]
}
```

---

## Step 6: Use the HTTP API for Automated Triage

For integrating Holmes into your incident response pipeline:

### Structured Output for Incident Reports

```python
import requests

response = requests.post(
    "https://<HOLMESGPT_APP_URL>/api/chat",
    headers={
        "Authorization": "Bearer <HOLMESGPT_ADMIN_PASSWORD>",
        "Content-Type": "application/json"
    },
    json={
        "ask": f"Investigate the ECS service {service_name} failure. "
               f"CloudWatch alarm: {alarm_name}. Time: {alarm_time}.",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "IncidentReport",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "root_cause": {"type": "string"},
                        "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
                        "affected_services": {"type": "array", "items": {"type": "string"}},
                        "immediate_actions": {"type": "array", "items": {"type": "string"}},
                        "long_term_fixes": {"type": "array", "items": {"type": "string"}},
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]}
                    },
                    "required": ["root_cause", "severity", "affected_services",
                                 "immediate_actions", "long_term_fixes", "confidence"]
                }
            }
        }
    }
)

report = response.json()
# report["analysis"] contains the JSON string
import json
incident = json.loads(report["analysis"])
```

### SSE Streaming for Real-Time Updates

```python
import sseclient

response = requests.post(
    "https://<HOLMESGPT_APP_URL>/api/chat",
    headers={"Authorization": "Bearer <HOLMESGPT_ADMIN_PASSWORD>"},
    json={"ask": "Why is payment-service down?", "stream": True},
    stream=True
)

client = sseclient.SSEClient(response)
for event in client.events():
    data = json.loads(event.data)
    if event.event == "start_tool_calling":
        print(f"Calling tool: {data['tool_name']}")
    elif event.event == "ai_message":
        print(data["content"], end="", flush=True)
    elif event.event == "ai_answer_end":
        print("\n\nFinal answer:", data["analysis"])
        break
```

---

## Step 7: CI/CD Integration

Add Holmes triage to your deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to EKS
  run: |
    kubectl set image deployment/payment-service app=$NEW_IMAGE
    if ! kubectl rollout status deployment/payment-service --timeout=120s; then
      # Trigger Holmes investigation
      curl -s -X POST \
        -H "Authorization: Bearer $HOLMES_API_KEY" \
        -H "Content-Type: application/json" \
        https://<HOLMESGPT_APP_URL>/api/chat \
        -d "{\"ask\": \"Deployment of payment-service to $NEW_IMAGE failed. \
             Rollout did not complete in 120s. What is wrong?\"}" \
        | jq -r '.analysis'
      kubectl rollout undo deployment/payment-service
      exit 1
    fi
```

---

## Quick Reference: Best Investigation Prompts

| Scenario | Prompt Pattern |
|---|---|
| Pod crash loop | `"Why is {pod} in namespace {ns} crash looping? It started at {time}."` |
| High error rate | `"The error rate for {service} spiked to {rate}% at {time}. What is causing it?"` |
| Slow response | `"Response time for {service} increased from {baseline}ms to {current}ms. Root cause?"` |
| OOM kill | `"Pod {pod} is being OOMKilled. Memory limit is {limit}. What is consuming memory?"` |
| DB connection | `"Service {svc} cannot connect to {db}. Error: {error}. What is wrong?"` |
| Deployment failure | `"Deployment {deploy} failed to roll out. New image: {image}. What is wrong?"` |
| Node pressure | `"Nodes in {cluster} have {condition} pressure. Pods are being evicted. Why?"` |
| ALB unhealthy | `"ALB target group {tg} has {n} unhealthy targets. Health check: {path}. Why?"` |
| Lambda throttle | `"Lambda {fn} is being throttled. Concurrency limit: {limit}. What is the impact?"` |
| RDS slow queries | `"RDS instance {db} has high CPU and slow query count. What queries are causing it?"` |

---

## Operator Mode: Proactive Health Checks

Set up scheduled checks for your AWS application:

```yaml
# scheduled-checks.yaml
apiVersion: holmesgpt.dev/v1alpha1
kind: ScheduledHealthCheck
metadata:
  name: production-health
  namespace: holmesgpt
spec:
  schedule: "*/15 * * * *"   # Every 15 minutes
  query: |
    Check the health of the production environment:
    1. Are all ECS services running at desired count?
    2. Are any pods in CrashLoopBackOff or OOMKilled?
    3. Are RDS connections within normal range?
    4. Are there any critical CloudWatch alarms firing?
    Report only if issues are found.
  timeout: 120
  destinations:
    - type: slack
      config:
        channel: "#platform-alerts"
```

```bash
kubectl apply -f scheduled-checks.yaml
kubectl get scheduledhealthchecks
kubectl describe scheduledhealthcheck production-health
```
