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
