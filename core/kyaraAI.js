const https = require('https');
const personality = require('./kyaraPersonality');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama3-70b-8192';

function callGroq(systemPrompt, messages, maxTokens = 120) {
  return new Promise((resolve) => {
    if (!GROQ_API_KEY) {
      console.log('[KYARA AI] No GROQ_API_KEY set');
      resolve(personality.pickRandom(["eh, can't think straight rn 😅", "my brain's not connecting rn", "ugh, lag in my head"]));
    }

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || "...";
          resolve(content.trim());
        } catch (e) {
          resolve("Eh something broke 😅");
        }
      });
    });

    req.on('error', () => resolve("Connection issue 😅"));
    req.setTimeout(8000, () => { req.destroy(); resolve("..."); });
    req.write(body);
    req.end();
  });
}

async function generateResponse(playerName, message, context, recentChat) {
  const ctxLines = [];
  if (context.isOwner) ctxLines.push("This is your owner. Show respect.");
  else if (context.isAlly) ctxLines.push("This player is a trusted ally.");
  else if (context.isHostile) ctxLines.push("This player has been hostile. Roast freely.");
  if (context.nickname && context.nickname !== playerName) ctxLines.push(`Their nickname is ${context.nickname}.`);
  ctxLines.push(`They speak ${context.language}. Match their language.`);
  if (context.tone === 'toxic') ctxLines.push("They're being toxic. Full roast mode.");
  else if (context.tone === 'friendly') ctxLines.push("They're being friendly. Be a little warmer.");

  const ctxStr = ctxLines.join(' ');
  const recentStr = recentChat && recentChat.length ? recentChat.map(m => `${m.username || 'Player'}: ${m.message}`).join('\n') : '';

  const messages = [
    { role: 'user', content: `${ctxStr}\n\nRecent chat:\n${recentStr}\n\n${playerName}: ${message}\n\nKYARA:` }
  ];

  let resp = await callGroq(personality.SYSTEM_PROMPT, messages, 100);
  if (resp && resp.length > 250) resp = resp.slice(0, 250);
  return resp;
}

async function reasonAbout(problem) {
  const messages = [
    { role: 'user', content: `You are KYARA, an autonomous Minecraft bot. Reason briefly about this situation in 1-2 sentences: ${problem}` }
  ];
  return await callGroq(personality.SYSTEM_PROMPT, messages, 120);
}

async function classifyIntent(message) {
  // Lightweight local classification - avoids extra API calls
  const m = message.toLowerCase();
  if (m.startsWith('!')) return { type: 'command' };
  const actions = [
    { keywords: ['come here', 'come to me', 'cmere', 'come'], type: 'move_come' },
    { keywords: ['follow me', 'follow '], type: 'follow' },
    { keywords: ['stop', 'cancel', 'wait', 'halt'], type: 'stop' },
    { keywords: ['go to', 'goto'], type: 'goto' },
    { keywords: ['kill', 'attack', 'fight'], type: 'combat' },
    { keywords: ['defend', 'protect'], type: 'defend' },
    { keywords: ['mine', 'get me', 'find '], type: 'mine' },
    { keywords: ['strip mine', 'branch mine'], type: 'stripmine' },
    { keywords: ['dig down', 'dig to'], type: 'dig' },
    { keywords: ['craft', 'make me', 'make a', 'make'], type: 'craft' },
    { keywords: ['build a', 'build me', 'build'], type: 'build' },
    { keywords: ['plant', 'farm '], type: 'farm' },
    { keywords: ['harvest'], type: 'harvest' },
    { keywords: ['give me', 'drop '], type: 'give' },
    { keywords: ['deposit', 'put stuff away', 'store'], type: 'deposit' },
    { keywords: ['what do you have', 'inventory'], type: 'inventory' },
    { keywords: ['eat', 'eat something'], type: 'eat' },
    { keywords: ['sleep', 'go to sleep'], type: 'sleep' },
    { keywords: ['explore', 'go explore', 'wander'], type: 'explore' },
    { keywords: ['find a village', 'find a dungeon', 'find structure'], type: 'findstructure' }
  ];
  for (const a of actions) {
    for (const k of a.keywords) {
      if (m.includes(k)) return { type: a.type };
    }
  }
  return { type: 'chat' };
}

module.exports = { callGroq, generateResponse, reasonAbout, classifyIntent };