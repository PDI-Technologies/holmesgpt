Investigate an alert or incident using HolmesGPT's HTTP API with real-time SSE streaming.

$ARGUMENTS

## Usage

```
/investigate-alert <alert description>
```

Example:
```
/investigate-alert The payment-service ECS task is restarting every 5 minutes. CloudWatch alarm PaymentServiceErrorRate fired at 14:32 UTC.
```

## Step 1: Authenticate

```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF
curl -s -c /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json
```

## Step 2: Run Investigation with SSE Streaming

Write the question to a file to avoid shell escaping issues:

```bash
cat > /tmp/investigate.json << EOF
{
  "ask": "$ARGUMENTS",
  "stream": false
}
EOF

curl -s -b /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/api/chat \
  -H "Content-Type: application/json" \
  -d @/tmp/investigate.json \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('=== INVESTIGATION RESULT ===')
print(data.get('analysis', 'No analysis returned'))
if data.get('tool_calls'):
    print(f'\n=== TOOLS USED ({len(data[\"tool_calls\"])}) ===')
    for tc in data['tool_calls']:
        print(f'  - {tc[\"tool_name\"]}: {tc.get(\"description\", \"\")}')
"
```

## Step 3: For Structured Incident Report

Use JSON schema response format for machine-readable output:

```bash
cat > /tmp/investigate-structured.json << 'EOF'
{
  "ask": "REPLACE_WITH_ALERT_DESCRIPTION",
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "IncidentReport",
      "strict": true,
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
        "required": ["root_cause", "severity", "affected_services", "immediate_actions", "long_term_fixes", "confidence"]
      }
    }
  }
}
EOF

curl -s -b /tmp/cookies.txt \
  -X POST https://<HOLMESGPT_APP_URL>/api/chat \
  -H "Content-Type: application/json" \
  -d @/tmp/investigate-structured.json \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
report = json.loads(data['analysis'])
print(f'Severity:  {report[\"severity\"].upper()}')
print(f'Confidence: {report[\"confidence\"]}')
print(f'\nRoot Cause:\n  {report[\"root_cause\"]}')
print(f'\nAffected Services: {', '.join(report[\"affected_services\"])}')
print(f'\nImmediate Actions:')
for a in report['immediate_actions']:
    print(f'  → {a}')
print(f'\nLong-term Fixes:')
for f in report['long_term_fixes']:
    print(f'  ✓ {f}')
"
```

## AWS-Specific Investigation Prompts

For common AWS scenarios, use these prompt patterns:

| Scenario | Prompt |
|---|---|
| ECS task restarts | `"The ECS service {name} in cluster {cluster} is restarting. CloudWatch alarm {alarm} fired at {time}. What is the root cause?"` |
| RDS connections | `"The {service} pods are failing with 'too many connections' to RDS {db}. Error started at {time}. Investigate."` |
| Lambda throttling | `"The {function} Lambda is being throttled. It processes SQS messages from {queue}. What is causing throttling and what is the impact?"` |
| ALB unhealthy | `"The ALB target group {tg} has {n} unhealthy targets. Health check path: {path}. Why are targets failing?"` |
| Pod OOMKilled | `"Pod {pod} in namespace {ns} is being OOMKilled. Memory limit is {limit}. What is consuming memory?"` |
| High error rate | `"Error rate for {service} spiked to {rate}% at {time}. What is causing it?"` |

## Report Results

After investigation completes, report:
1. Root cause (one sentence)
2. Severity assessment
3. Immediate remediation steps
4. Tools Holmes used to investigate
5. Confidence level
