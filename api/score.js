export default async function handler(req, res) {

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Your Anthropic API key is stored in Vercel environment variables
  // Never hardcode it here — Vercel injects it at runtime
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    // Forward the request body to Anthropic exactly as received
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Forward Anthropic's response back to the browser
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', detail: error.message });
  }
}

