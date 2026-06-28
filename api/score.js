// Vercel serverless function — Anthropic API proxy
// Keeps the API key server-side, away from the browser

export const config = {
  maxDuration: 60,  // Maximum allowed on Vercel Hobby plan
};

const ALLOWED_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

const MAX_TOKENS_CAP = 4096;

// Set on your Vercel project: ALLOWED_ORIGIN=https://yourdomain.com
// Leave unset to allow all origins (only do this for public/personal tools)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export default async function handler(req, res) {

  // CORS headers always set so browsers can read error responses too
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured',
      detail: 'Add ANTHROPIC_API_KEY to Vercel environment variables, then redeploy.'
    });
  }

  const { model, messages, system, max_tokens, tools, tool_choice } = req.body ?? {};

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({
      error: 'Invalid or missing model',
      allowed: ALLOWED_MODELS,
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const clampedMaxTokens = Math.min(
    typeof max_tokens === 'number' && max_tokens > 0 ? max_tokens : MAX_TOKENS_CAP,
    MAX_TOKENS_CAP
  );

  // Only forward known-safe fields — never pass unknown keys to Anthropic
  const payload = {
    model,
    messages,
    max_tokens: clampedMaxTokens,
    ...(system !== undefined && { system }),
    ...(tools !== undefined && { tools }),
    ...(tool_choice !== undefined && { tool_choice }),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      error: 'Proxy request failed',
      detail: error.message
    });
  }
}
