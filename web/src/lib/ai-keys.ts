const STORAGE_KEY = 'fgs_ai_keys';

export interface ProviderConfig {
  type: string;
  name: string;
  description: string;
  keyPlaceholder: string;
  free: boolean;
  models: { id: string; name: string }[];
  docsUrl: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    description: 'GPT and o-series models directly. Most users already have a key.',
    keyPlaceholder: 'sk-proj-...',
    free: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    type: 'openrouter',
    name: 'OpenRouter',
    description: '367+ models with one API key. Claude, GPT, Gemini, and more.',
    keyPlaceholder: 'sk-or-v1-...',
    free: false,
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    type: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models directly. Lowest latency for Claude.',
    keyPlaceholder: 'sk-ant-api03-...',
    free: false,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    type: 'google',
    name: 'Google AI',
    description: 'Gemini models. 1M+ context window.',
    keyPlaceholder: 'AIza...',
    free: false,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
];

export const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = Object.fromEntries(
  PROVIDERS.map((p) => [p.type, p.models.map((m) => ({ value: m.id, label: m.name }))]),
);

function getSavedKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveKey(provider: string, key: string) {
  const keys = getSavedKeys();
  if (key) keys[provider] = key;
  else delete keys[provider];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getKey(provider: string): string {
  return getSavedKeys()[provider] || '';
}

export function getDefaultProvider(): string {
  const stored = localStorage.getItem('fgs_provider');
  if (stored && PROVIDERS.some((p) => p.type === stored)) return stored;
  return 'openai';
}

export function getDefaultModel(): string {
  const p = getDefaultProvider();
  const stored = localStorage.getItem('fgs_model');
  const valid = MODEL_OPTIONS[p]?.some((m) => m.value === stored);
  return valid ? stored! : MODEL_OPTIONS[p]?.[0]?.value || 'gpt-4o';
}
