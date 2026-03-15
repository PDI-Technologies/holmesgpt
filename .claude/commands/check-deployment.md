Check the health of the live HolmesGPT deployment.

Run these checks and report a clear status summary:

1. Health endpoints (no auth needed):
```bash
curl -s https://<HOLMESGPT_APP_URL>/healthz
curl -s https://<HOLMESGPT_APP_URL>/readyz
```

2. Pod status:
```bash
aws eks update-kubeconfig --name holmesgpt-dev --profile <AWS_PROFILE> --region us-east-1 2>/dev/null
kubectl get pods -n holmesgpt -o wide
```

3. Integration status (login first using a file to avoid shell escaping issues):
```bash
cat > /tmp/login.json << 'EOF'
{"username":"admin","password":"<HOLMESGPT_ADMIN_PASSWORD>"}
EOF
curl -s -c /tmp/cookies.txt -X POST \
  https://<HOLMESGPT_APP_URL>/auth/login \
  -H "Content-Type: application/json" -d @/tmp/login.json

curl -s -b /tmp/cookies.txt \
  https://<HOLMESGPT_APP_URL>/api/integrations \
  | tr '{' '\n' | grep '"status"' | grep -v "disabled" \
  | grep -oE '"name":"[^"]+"|"status":"[^"]+"|"error":"[^"]+"' | paste - - -
```

4. Recent pod logs (last 20 lines, filter noise):
```bash
kubectl logs -n holmesgpt -l app.kubernetes.io/name=holmes --tail=20 \
  | grep -v "Received session\|Negotiated protocol\|GET stream"
```

Report:
- Overall status (healthy/degraded/down)
- Pod status and age
- Which integrations are enabled, failed, or have errors
- Any concerning log lines
- Recommended actions if anything is broken (reference debug-deployment skill for fixes)
