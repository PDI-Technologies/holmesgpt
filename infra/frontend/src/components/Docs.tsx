import { useState } from 'react'

type DocTab = 'aws' | 'pagerduty' | 'ado' | 'salesforce'

const SH_SCRIPT = `#!/bin/bash
# HolmesGPT AWS Account Connection Script
# Creates a read-only IAM role for HolmesGPT to investigate your AWS account
set -e

ROLE_NAME="HolmesGPT-ReadOnly"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Setting up HolmesGPT role in account: $ACCOUNT_ID"

aws iam create-role \\
  --role-name "$ROLE_NAME" \\
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \\
  --description "HolmesGPT read-only investigation role" 2>/dev/null || echo "Role already exists, updating..."

aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/ReadOnlyAccess"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo ""
echo "Success! Copy this Role ARN into HolmesGPT Integrations:"
echo "$ROLE_ARN"
`

const PS1_SCRIPT = `# HolmesGPT AWS Account Connection Script (PowerShell)
# Creates a read-only IAM role for HolmesGPT to investigate your AWS account

$RoleName = "HolmesGPT-ReadOnly"
$AccountId = (aws sts get-caller-identity --query Account --output text)
Write-Host "Setting up HolmesGPT role in account: $AccountId"

$Trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam create-role --role-name $RoleName --assume-role-policy-document $Trust --description "HolmesGPT read-only investigation role" 2>$null

aws iam attach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::aws:policy/ReadOnlyAccess"

$RoleArn = (aws iam get-role --role-name $RoleName --query Role.Arn --output text)
Write-Host ""
Write-Host "Success! Copy this Role ARN into HolmesGPT Integrations:"
Write-Host $RoleArn
`

function downloadScript(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const tabs: { id: DocTab; label: string }[] = [
  { id: 'aws', label: 'AWS Account' },
  { id: 'pagerduty', label: 'PagerDuty' },
  { id: 'ado', label: 'Azure DevOps' },
  { id: 'salesforce', label: 'Salesforce' },
]

interface StepListProps {
  steps: (string | React.ReactNode)[]
}

function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-3 text-sm text-gray-700">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pdi-sky/10 text-pdi-sky text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  )
}

interface CopyableUrlProps {
  url: string
  urlKey: string
  copied: string | null
  onCopy: (text: string, key: string) => void
}

function CopyableUrl({ url, urlKey, copied, onCopy }: CopyableUrlProps) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-700">
      <span className="flex-1 truncate">{url}</span>
      <button
        onClick={() => onCopy(url, urlKey)}
        className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          copied === urlKey
            ? 'bg-pdi-grass/10 text-pdi-grass border border-pdi-grass/20'
            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {copied === urlKey ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

export default function Docs() {
  const [activeTab, setActiveTab] = useState<DocTab>('aws')
  const [copied, setCopied] = useState<string | null>(null)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Step-by-step guides for connecting your infrastructure to HolmesGPT.
          </p>
        </div>

        {/* Tab bar */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-pdi-sky text-pdi-sky'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">

          {/* AWS Account Tab */}
          {activeTab === 'aws' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Connect an AWS Account</h2>
                <p className="text-sm text-gray-500">
                  This script creates a read-only IAM role in your AWS account that HolmesGPT uses to investigate issues.
                  No write permissions are granted — HolmesGPT can only read resource configurations and metrics.
                </p>
              </div>

              <StepList
                steps={[
                  <>Ensure the <strong>AWS CLI</strong> is installed and configured for the account you want to connect (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">aws configure</code>).</>,
                  <>Download the setup script for your operating system using the buttons below.</>,
                  <>Run the script. It will create a role named <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">HolmesGPT-ReadOnly</code> and print its ARN.</>,
                  <>Copy the <strong>Role ARN</strong> printed by the script.</>,
                  <>In HolmesGPT, go to <strong>Integrations</strong> → add an AWS integration → paste the Role ARN.</>,
                ]}
              />

              {/* Download buttons */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Download Setup Script</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => downloadScript('connect-aws.sh', SH_SCRIPT)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-pdi-sky rounded-lg hover:bg-pdi-indigo transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download for Linux / Mac (.sh)
                  </button>
                  <button
                    onClick={() => downloadScript('connect-aws.ps1', PS1_SCRIPT)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download for Windows (.ps1)
                  </button>
                </div>
              </div>

              {/* Script preview */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Script Preview (Linux / Mac)</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-700 overflow-x-auto leading-relaxed">
                  {SH_SCRIPT.split('\n').slice(0, 12).join('\n')}
                  {'\n...'}
                </pre>
              </div>
            </div>
          )}

          {/* PagerDuty Tab */}
          {activeTab === 'pagerduty' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Add a PagerDuty Webhook</h2>
                <p className="text-sm text-gray-500">
                  Connect PagerDuty so HolmesGPT automatically investigates incidents when they are triggered, acknowledged, or resolved.
                </p>
              </div>

              <StepList
                steps={[
                  <>Log in to PagerDuty → <strong>Integrations</strong> → <strong>Generic Webhooks (V3)</strong>.</>,
                  <>Click <strong>+ New Webhook</strong>.</>,
                  <>Set the <strong>Endpoint URL</strong> to the URL shown below.</>,
                  <>Select event types: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">incident.triggered</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">incident.acknowledged</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">incident.resolved</code>.</>,
                  <>Click <strong>Save</strong> and copy the <strong>Webhook Secret</strong> shown after saving.</>,
                  <>In HolmesGPT, go to <strong>Integrations</strong> → PagerDuty → paste the webhook secret.</>,
                ]}
              />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Webhook Endpoint URL</p>
                <CopyableUrl
                  url="https://<your-holmesgpt-url>/api/webhook/pagerduty"
                  urlKey="pagerduty"
                  copied={copied}
                  onCopy={copyText}
                />
                <p className="mt-2 text-xs text-gray-400">Replace <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;your-holmesgpt-url&gt;</code> with your HolmesGPT deployment URL.</p>
              </div>
            </div>
          )}

          {/* ADO Tab */}
          {activeTab === 'ado' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Add an Azure DevOps Webhook</h2>
                <p className="text-sm text-gray-500">
                  Connect Azure DevOps so HolmesGPT can investigate work items and receive notifications when items are created or updated.
                </p>
              </div>

              <StepList
                steps={[
                  <>In Azure DevOps, go to <strong>Project Settings</strong> → <strong>Service Hooks</strong>.</>,
                  <>Click <strong>+</strong> → select <strong>Web Hooks</strong>.</>,
                  <>Choose a trigger: <strong>Work item created</strong> or <strong>Work item updated</strong>.</>,
                  <>Set the <strong>URL</strong> to the endpoint shown below.</>,
                  <>Set HTTP headers: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Content-Type: application/json</code>.</>,
                  <>Click <strong>Finish</strong> to save the service hook.</>,
                  <>In HolmesGPT, go to <strong>Integrations</strong> → ADO → enter your ADO organization URL and Personal Access Token (PAT).</>,
                ]}
              />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Webhook Endpoint URL</p>
                <CopyableUrl
                  url="https://<your-holmesgpt-url>/api/webhook/ado"
                  urlKey="ado"
                  copied={copied}
                  onCopy={copyText}
                />
                <p className="mt-2 text-xs text-gray-400">Replace <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;your-holmesgpt-url&gt;</code> with your HolmesGPT deployment URL.</p>
              </div>
            </div>
          )}

          {/* Salesforce Tab */}
          {activeTab === 'salesforce' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Add a Salesforce Webhook</h2>
                <p className="text-sm text-gray-500">
                  Connect Salesforce so HolmesGPT receives case updates via outbound messages and can investigate customer issues automatically.
                </p>
              </div>

              <StepList
                steps={[
                  <>In Salesforce Setup, search for <strong>Outbound Messages</strong> in the Quick Find box.</>,
                  <>Click <strong>New Outbound Message</strong> for the <strong>Case</strong> object.</>,
                  <>Set the <strong>Endpoint URL</strong> to the URL shown below.</>,
                  <>Select fields to include: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">CaseNumber</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Subject</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Status</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Priority</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Description</code>.</>,
                  <>Create a <strong>Workflow Rule</strong> (or Flow) that triggers this outbound message on case create or update.</>,
                  <><strong>Activate</strong> the workflow rule.</>,
                  <>In HolmesGPT, go to <strong>Integrations</strong> → Salesforce → enter your Org ID and credentials.</>,
                ]}
              />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Webhook Endpoint URL</p>
                <CopyableUrl
                  url="https://<your-holmesgpt-url>/api/webhook/salesforce"
                  urlKey="salesforce"
                  copied={copied}
                  onCopy={copyText}
                />
                <p className="mt-2 text-xs text-gray-400">Replace <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;your-holmesgpt-url&gt;</code> with your HolmesGPT deployment URL.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
