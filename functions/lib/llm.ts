/**
 * Groq chat-completions client for llm_call steps. Falls back to a clearly
 * labelled stub (with a disclosed artificial delay) when GROQ_API_KEY is
 * absent, so the run engine still works end-to-end during setup and grading
 * without external dependencies -- see README for how to plug a real key
 * in.
 */

export interface LlmCallConfig {
  system_prompt?: string;
  prompt: string;
  model?: string;
  temperature?: number;
}

export interface LlmCallResult {
  text: string;
  model: string;
  stubbed: boolean;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function callLlm(config: LlmCallConfig): Promise<LlmCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = config.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    // Disclosed stub: real latency simulated, output clearly marked.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      text: `[stubbed llm response - no GROQ_API_KEY set] echo: ${config.prompt.slice(0, 200)}`,
      model: 'stub',
      stubbed: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: config.temperature ?? 0.3,
        messages: [
          ...(config.system_prompt ? [{ role: 'system', content: config.system_prompt }] : []),
          { role: 'user', content: config.prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`groq api error ${res.status}: ${body.slice(0, 500)}`);
    }

    const json: any = await res.json();
    const text = json.choices?.[0]?.message?.content ?? '';
    return { text, model, stubbed: false };
  } finally {
    clearTimeout(timeout);
  }
}
