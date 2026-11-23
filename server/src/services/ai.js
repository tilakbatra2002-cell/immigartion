import env, { flags } from '../config/env.js';
import AIUsage from '../models/AIUsage.js';
import { ApiError } from '../utils/apiError.js';

export const aiStatus = () => ({
  configured: flags.ai,
  provider: env.AI_PROVIDER,
  model: flags.ai ? env.AI_MODEL : null,
  baseUrl: flags.ai ? env.AI_BASE_URL : null,
});

const SYSTEM_GUARDRAILS = `You are the AI assistant inside ImmigrationFlow, a professional immigration consultancy management platform.
Rules you must always follow:
- Never guarantee or predict visa outcomes, approval chances, or eligibility decisions. Do not say a client "will" or "is likely to" be approved/refused.
- Never claim to submit applications or take legal decisions. Recommend that a licensed human consultant review everything.
- Clearly separate "extracted from document" (unverified) from verified data.
- Be concise, professional, and use plain business English. Do not use markdown headings larger than ###.
- Do not reveal personal data belonging to anyone other than the client in context.`;

function buildProviderError(status, message) {
  if (status === 401 || status === 403) return new ApiError(502, 'AI provider rejected the configured API key. Check Settings → AI.');
  if (status === 429) return new ApiError(429, 'AI provider rate limit reached. Try again shortly.');
  return new ApiError(502, `AI provider error: ${message}`);
}

/**
 * Chat completion against any OpenAI-compatible endpoint.
 * Server-side only; API keys never leave the backend.
 */
export async function aiChat({ messages, temperature = 0.4, maxTokens = 1200, jsonMode = false }) {
  if (!flags.ai) {
    throw new ApiError(503, 'AI is not configured. Add an API key in Settings → AI, or continue using the built-in non-AI workflows.', null, 'AI_NOT_CONFIGURED');
  }
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: SYSTEM_GUARDRAILS }, ...messages],
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw buildProviderError(res.status, data?.error?.message || res.statusText);
    return {
      content: data?.choices?.[0]?.message?.content?.trim() || '',
      usage: data?.usage || {},
      model: data?.model || env.AI_MODEL,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError(504, 'AI provider timed out. Please retry.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function trackAIUsage({ organizationId, userId, feature, result, status = 'SUCCESS', error, entityType, entityId }) {
  try {
    await AIUsage.create({
      organizationId, userId, feature,
      provider: env.AI_PROVIDER,
      model: result?.model || env.AI_MODEL,
      promptTokens: result?.usage?.prompt_tokens || 0,
      completionTokens: result?.usage?.completion_tokens || 0,
      totalTokens: result?.usage?.total_tokens || 0,
      entityType, entityId, status, error, latencyMs: result?.latencyMs,
    });
  } catch { /* non-critical */ }
}

/** Safe JSON parse for AI output. */
export function parseAIJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch { return null; } }
    return null;
  }
}

export const redactForAI = (text = '') => String(text).slice(0, env.AI_MAX_INPUT_CHARS);
