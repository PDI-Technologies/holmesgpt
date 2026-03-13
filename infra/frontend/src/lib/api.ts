const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  ask: string;
  conversation_history?: ChatMessage[];
  stream?: boolean;
}

export interface ChatResponse {
  analysis: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  tool_name: string;
  description: string;
  result: string;
}

export interface InvestigateRequest {
  source: string;
  title: string;
  description: string;
  subject: Record<string, string>;
  context: Record<string, string>;
  include_tool_calls?: boolean;
  include_tool_call_results?: boolean;
}

export interface InvestigateResponse {
  analysis: string;
  tool_calls?: ToolCall[];
}

export interface ModelInfo {
  model_name: string;
}

export interface HealthStatus {
  status: string;
}

export interface ConfigField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'dict' | 'list';
  required: boolean;
  default: unknown;
  description: string;
  sensitive: boolean;
}

export interface Integration {
  name: string;
  description: string;
  status: 'enabled' | 'disabled' | 'failed';
  type: 'built-in' | 'custom' | 'mcp' | 'http' | 'database';
  error: string | null;
  icon_url: string | null;
  docs_url: string | null;
  tool_count: number;
  enabled: boolean;
  config: Record<string, unknown>;
  config_schema: ConfigField[];
}

export interface IntegrationsResponse {
  integrations: Integration[];
}

export interface AwsAccount {
  name: string;
  account_id: string;
  region: string;
  role_arn: string;
}

export interface AwsAccountsResponse {
  accounts: AwsAccount[];
  irsa_role: string;
}

export interface LlmInstructionsEntry {
  name: string;
  description: string;
  type: string;
  icon_url: string | null;
  enabled: boolean;
  instructions: string;
  has_default: boolean;
  is_overridden: boolean;
}

export interface LlmInstructionsResponse {
  integrations: LlmInstructionsEntry[];
}

export interface UpdateLlmInstructionsResponse {
  name: string;
  instructions: string;
  is_overridden: boolean;
}

export interface ToolsetInstance {
  type: string;
  name: string;
  secret_arn: string | null;
  /** For MCP toolsets: override the MCP server URL (null = use global URL) */
  mcp_url?: string | null;
  /** For aws_api: restrict to these account profile names (null = all configured accounts) */
  aws_accounts?: string[] | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instances: ToolsetInstance[];
  created_at: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export const api = {
  chat(data: ChatRequest): Promise<ChatResponse> {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async chatStream(
    data: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...data, stream: true }),
      signal,
    });

    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  },

  investigate(data: InvestigateRequest): Promise<InvestigateResponse> {
    return request('/api/investigate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getModel(): Promise<ModelInfo> {
    return request('/api/model');
  },

  async getHealth(): Promise<HealthStatus> {
    return request('/healthz');
  },

  async getReadiness(): Promise<HealthStatus> {
    return request('/readyz');
  },

  getIntegrations(): Promise<IntegrationsResponse> {
    return request('/api/integrations');
  },

  getAwsAccounts(): Promise<AwsAccountsResponse> {
    return request('/api/aws/accounts');
  },

  getLlmInstructions(): Promise<LlmInstructionsResponse> {
    return request('/api/llm-instructions');
  },

  updateLlmInstructions(name: string, instructions: string): Promise<UpdateLlmInstructionsResponse> {
    return request(`/api/llm-instructions/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ instructions }),
    });
  },

  resetLlmInstructions(name: string): Promise<UpdateLlmInstructionsResponse> {
    return request(`/api/llm-instructions/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },

  toggleIntegration(name: string, enabled: boolean): Promise<Integration> {
    return request(`/api/integrations/${encodeURIComponent(name)}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  },

  updateIntegrationConfig(name: string, config: Record<string, unknown>, enabled?: boolean): Promise<Integration> {
    return request(`/api/integrations/${encodeURIComponent(name)}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config, enabled }),
    });
  },

  getProjects(): Promise<ProjectsResponse> {
    return request('/api/projects');
  },

  createProject(data: { name: string; description?: string; instances?: ToolsetInstance[] }): Promise<Project> {
    return request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProject(id: string, data: Partial<{ name: string; description: string; instances: ToolsetInstance[] }>): Promise<Project> {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProject(id: string): Promise<{ ok: boolean }> {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async login(username: string, password: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return { ok: true };
  },

  async logout(): Promise<void> {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async checkAuth(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE}/auth/check`, { credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  },
};
