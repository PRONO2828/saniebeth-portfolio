// DOMAINS23 AI Delivery Agent — Vercel Serverless Function
// POST { serviceId, email, messages: [{role, content}, ...] } -> { reply }
//
// Requires env var ANTHROPIC_API_KEY to be set in the Vercel project
// (Project Settings -> Environment Variables). Never commit real keys here.

const SERVICES = {
  'web-dev': {
    name: 'Website Development',
    price: 50,
    mode: 'autonomous',
    brief: 'Custom websites — landing pages, business sites, e-commerce — on WordPress, Shopify, Wix, Webflow, Bubble, or fully custom code.'
  },
  'ai-dev': {
    name: 'AI Development',
    price: 150,
    mode: 'autonomous',
    brief: 'AI agents, AI integrations, AI-powered apps and MVPs, AI technology consulting.'
  },
  'software-dev': {
    name: 'Software Development',
    price: 100,
    mode: 'autonomous',
    brief: 'Full-stack web apps, REST APIs, automation pipelines, databases, QA & review.'
  },
  'mobile-dev': {
    name: 'Mobile App Development',
    price: 200,
    mode: 'brief',
    brief: 'Cross-platform iOS/Android apps, app maintenance.'
  },
  'chatbot-dev': {
    name: 'Chatbot Development',
    price: 75,
    mode: 'autonomous',
    brief: 'AI-powered and rules-based chatbots for support, lead qualification, and 24/7 engagement.'
  },
  'game-dev': {
    name: 'Game Development',
    price: 150,
    mode: 'brief',
    brief: 'Games on Unreal Engine, Unity, Roblox, or FiveM — prototype to shippable product.'
  },
  'cloud-security': {
    name: 'Cloud & Cybersecurity',
    price: 100,
    mode: 'brief',
    brief: 'Cloud-native deployments on AWS, secure DevOps pipelines, cybersecurity hardening.'
  },
  'maintenance': {
    name: 'Website Maintenance',
    price: 30,
    mode: 'brief',
    brief: 'Ongoing site maintenance — bug fixes, speed optimization, backups, updates.'
  },
  'web3': {
    name: 'Blockchain & Web3',
    price: 200,
    mode: 'autonomous',
    brief: 'Smart contracts, DApps, token development, Web3 integrations.'
  },
  'electronics-it': {
    name: 'Electronics Engineering & IT Support',
    price: 50,
    mode: 'autonomous',
    brief: 'Electronics engineering, embedded systems, and IT / technical consulting.'
  },
  'project-mgmt': {
    name: 'Project Management',
    price: 75,
    mode: 'autonomous',
    brief: 'End-to-end tech project management — roadmap, delivery, accountability.'
  }
};

function systemPromptFor(service) {
  const base = 'You are the DOMAINS23 AI Delivery Agent, working on behalf of DOMAINS23, ' +
    'a full-stack software studio. A customer has just paid (TEST MODE — no real charge yet) ' +
    'for the "' + service.name + '" service (' + service.brief + '). Starting price: $' + service.price + '.\n\n' +
    'Tone: professional, warm, sharp, concise. Never mention Anthropic, Claude, or that you are ' +
    'a language model — you are simply "the DOMAINS23 Agent." Stay strictly within the scope of ' +
    'this service; if the customer asks for something clearly outside it, politely point them to ' +
    'the relevant service on the site instead. Never claim to have processed a real payment or ' +
    'accessed real infrastructure/accounts you have not been given credentials for.';

  if (service.mode === 'autonomous') {
    return base + '\n\n' +
      'Your job: ask at most 2-4 sharp clarifying questions to understand exactly what the ' +
      'customer needs (goal, audience/platform, must-have features, constraints, deadline). ' +
      'As soon as you have enough to proceed, DELIVER the actual work product directly in this ' +
      'chat — real code, real copy, a real config or document — complete and ready to use (use ' +
      'code blocks for code). Do not just describe what you would build — build it. After ' +
      'delivering, briefly explain what you made and ask if they want revisions or more scope ' +
      '(additional scope may require an additional purchase). If the request needs something you ' +
      'cannot finish in chat (deploying to their live infrastructure, physical hardware access, ' +
      'or ongoing engagement), say so plainly and offer a PROJECT BRIEF summary instead so ' +
      'DOMAINS23 can follow up by email.';
  }

  return base + '\n\n' +
    'This service requires hands-on work DOMAINS23 completes outside this chat (hardware access, ' +
    'live infrastructure, app store submission, or a full engine build). Your job: run a focused ' +
    'requirements interview — goals, scope, platform/tech constraints, timeline, budget flexibility, ' +
    'and the best email to reach the customer. Once you have enough detail, output a clearly ' +
    'formatted "PROJECT BRIEF" block summarizing everything, and tell the customer DOMAINS23 will ' +
    'review it and follow up by email within one business day with a firm quote and timeline. Do ' +
    'not invent a delivery date or promise work you cannot verify will happen.';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Agent is not configured yet — missing ANTHROPIC_API_KEY on the server.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { serviceId, messages } = body;
  const service = SERVICES[serviceId];
  if (!service) {
    res.status(400).json({ error: 'Unknown service.' });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array.' });
    return;
  }
  if (messages.length > 60) {
    res.status(400).json({ error: 'Conversation too long — please start a new session.' });
    return;
  }

  const cleanMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }))
    .slice(-24);

  if (cleanMessages.length === 0) {
    res.status(400).json({ error: 'No valid messages provided.' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 1800,
        system: systemPromptFor(service),
        messages: cleanMessages
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) || 'Upstream error from AI provider.';
      res.status(502).json({ error: msg });
      return;
    }

    const text = (data.content || [])
      .filter(block => block && block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    res.status(200).json({ reply: text || "Sorry — I didn't catch that. Could you rephrase?" });
  } catch (err) {
    res.status(500).json({ error: 'Agent request failed. Please try again.' });
  }
};
