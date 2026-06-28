// Vercel serverless function — Anthropic API proxy
// Keeps the API key server-side, away from the browser

// Extend Vercel's default 10-second timeout to 60 seconds.
// Required because Anthropic calls with web search can take 30–60 seconds.
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API key is stored in Vercel → Settings → Environment Variables
  // as ANTHROPIC_API_KEY — never hardcode it here
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured',
      detail: 'Add ANTHROPIC_API_KEY to Vercel environment variables, then redeploy.'
    });
  }

  try {
    // Forward the request body to Anthropic exactly as received from the browser
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Set CORS headers so the browser accepts the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Forward Anthropic's status and response back to the browser
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      error: 'Proxy request failed',
      detail: error.message
    });
  }
}
