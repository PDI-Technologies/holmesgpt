Add a new integration to HolmesGPT end-to-end: toolset or MCP server, tests, docs, and deployment.

$ARGUMENTS

## Step 1: Determine Integration Type

Ask the user (or infer from context):
- **MCP server**: The service already has an MCP endpoint (e.g., via PDI platform MCP API gateway at `mcp-api.platform.pditechnologies.com`). Use the `add-mcp-server` skill.
- **Built-in toolset**: Needs a Python wrapper with direct API calls. Use the `add-toolset` skill.

If unclear, prefer MCP for external services already on the PDI platform, and built-in toolset for new integrations that need custom logic.

## Step 2: Implement

For MCP server integrations:
- Follow the `add-mcp-server` skill
- Update `infra/helm.tf` with the new MCP server config and secret variable
- Update `infra/variables.tf` and `infra/envs/dev.tfvars`

For built-in toolsets:
- Follow the `add-toolset` skill
- Create `holmes/plugins/toolsets/{name}/` directory
- Register in `holmes/plugins/toolsets/__init__.py`

## Step 3: Write an Eval Test

Use the `create-eval` skill to write an LLM evaluation test that verifies Holmes can use the new integration to answer a real question. The test must:
- Use a unique verification code to prevent hallucinations
- Have a realistic user prompt (business language, not technical terms)
- Clean up after itself

## Step 4: Update Documentation

Update all five locations (see `add-toolset` skill Step 8):
1. `README.md` — Data Sources table
2. `docs/walkthrough/why-holmesgpt.md` — Integration list
3. `docs/data-sources/builtin-toolsets/index.md` — Grid card
4. `docs/data-sources/builtin-toolsets/{name}.md` — Dedicated page
5. `images/integration_logos/` — Logo image

## Step 5: Deploy

Use the `deploy-to-aws` skill or `/ship` command to deploy the changes to the PDI dev environment.

## Step 6: Verify

Use `/check-deployment` to confirm the new integration shows as `enabled` with a non-zero tool count.
