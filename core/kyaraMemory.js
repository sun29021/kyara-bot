const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const MAIN_FILE = path.join(MEMORY_DIR, 'kyara_memory.json');
const STRATEGY_FILE = path.join(MEMORY_DIR, 'strategy_memory.json');

if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });

const defaultMemory = {
  meta: { created: Date.now(), lastSave: Date.now(), totalUptime: 0, deathCount: 0, daysAlive: 0, startTime: Date.now() },
  base: { location: null, built: false, type: null, upgrades: [], nextUpgrade: 'wood_house', chestLocations: [], resourcesCollected: 0, waypoints: [] },
  inventory: { stash: {}, hotbar: {}, totalItems: 0 },
  survival: { confidenceLevel: 10, nearDeathCount: 0, lastFoodEaten: null, lastSlept: null },
  players: {},
  knownAIs: {}
};

const defaultStrategy = {
  mining: { preferredYLevel: -59, avoidYLevel: [], bestOreFound: {}, miningDeaths: 0, successfulRuns: 0, currentTactic: 'branch_mining' },
  combat: { preferredTactic: 'sword_shield', aggressiveness: 5, retreatThreshold: 6, knownDangerousMobs: ['creeper', 'enderman'], pvpWins: 0, pvpLosses: 0, deathCauses: [] },
  building: { preferredMaterial: 'dirt', completedBuilds: [], failedBuilds: [] },
  farming: { activeCrops: [], harvestCount: 0 },
  decisions: { log: [], improvementNotes: [] }
};

let memory = loadFile(MAIN_FILE, defaultMemory);
let strategy = loadFile(STRATEGY_FILE, defaultStrategy);

function loadFile(file, def) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return deepMerge(JSON.parse(JSON.stringify(def)), data);
    }
  } catch (e) {
    console.log('[KYARA MEMORY] Failed to load, using defaults:', e.message);
  }
  return JSON.parse(JSON.stringify(def));
}

function deepMerge(target, source) {
  if (typeof source !== 'object' || source === null) return source;
  if (typeof target !== 'object' || target === null) return source;
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      target[key] = source[key];
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function save() {
  try {
    memory.meta.lastSave = Date.now();
    const uptimeMs = Date.now() - (memory.meta.startTime || Date.now());
    memory.meta.totalUptime = Math.floor(uptimeMs / 60000);
    fs.writeFileSync(MAIN_FILE, JSON.stringify(memory, null, 2));
    fs.writeFileSync(STRATEGY_FILE, JSON.stringify(strategy, null, 2));
  } catch (e) {
    console.log('[KYARA MEMORY] Save error:', e.message);
  }
}

function reset() {
  memory = JSON.parse(JSON.stringify(defaultMemory));
  strategy = JSON.parse(JSON.stringify(defaultStrategy));
  save();
}

// --- Player operations ---
function getPlayer(name) {
  if (!memory.players[name]) {
    memory.players[name] = {
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      interactions: [],
      trust: 0,
      language: 'english',
      tone: 'neutral',
      nickname: null,
      likes: [],
      dislikes: [],
      isOwner: false,
      isAlly: false,
      isHostile: false,
      messageCount: 0
    };
  }
  memory.players[name].lastSeen = Date.now();
  return memory.players[name];
}

function recordInteraction(name, message, response) {
  const p = getPlayer(name);
  p.interactions.push({ t: Date.now(), m: message, r: response });
  if (p.interactions.length > 30) p.interactions = p.interactions.slice(-30);
  p.messageCount++;
}

function saveNickname(name, nick) {
  const p = getPlayer(name);
  p.nickname = nick;
}

function adjustTrust(name, delta, reason) {
  const p = getPlayer(name);
  p.trust = Math.max(-100, Math.min(100, p.trust + delta));
  if (delta < 0 && p.trust < -30) p.isHostile = true;
  if (delta > 0 && p.trust > 40) p.isAlly = true;
}

function setLanguage(name, lang) {
  const p = getPlayer(name);
  p.language = lang;
}

function setTone(name, tone) {
  const p = getPlayer(name);
  p.tone = tone;
}

function getContext(name) {
  const p = getPlayer(name) || {};
  return {
    nickname: p.nickname || name,
    trust: p.trust || 0,
    language: p.language || 'english',
    tone: p.tone || 'neutral',
    isOwner: !!p.isOwner,
    isAlly: !!p.isAlly,
    isHostile: !!p.isHostile,
    recentInteractions: (p.interactions || []).slice(-5).map(i => `${i.m} -> ${i.r}`)
  };
}

function setBase(location, type) {
  memory.base.location = location;
  memory.base.built = true;
  memory.base.type = type;
}

function addChest(pos, label) {
  memory.base.chestLocations.push({ x: pos.x, y: pos.y, z: pos.z, label });
}

function addWaypoint(name, pos) {
  memory.base.waypoints.push({ name, x: pos.x, y: pos.y, z: pos.z });
}

function addKnownAI(name, info = {}) {
  if (!memory.knownAIs[name]) {
    memory.knownAIs[name] = {
      firstMet: Date.now(),
      personality: info.personality || '',
      functions: info.functions || [],
      trust: info.trust || 0,
      learnedFrom: info.learnedFrom || []
    };
  } else {
    Object.assign(memory.knownAIs[name], info);
  }
}

function recordDecision(decision, outcome) {
  strategy.decisions.log.push({ t: Date.now(), decision, outcome });
  if (strategy.decisions.log.length > 50) strategy.decisions.log = strategy.decisions.log.slice(-50);
}

function addImprovementNote(note) {
  strategy.decisions.improvementNotes.push({ t: Date.now(), note });
  if (strategy.decisions.improvementNotes.length > 50) strategy.decisions.improvementNotes = strategy.decisions.improvementNotes.slice(-50);
}

function incrementStat(path, amount = 1) {
  const parts = path.split('.');
  let obj = strategy;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]] = obj[parts[i]] || {};
  }
  const last = parts[parts.length - 1];
  obj[last] = (obj[last] || 0) + amount;
}

setInterval(() => save(), 60000);

module.exports = {
  memory,
  strategy,
  save,
  reset,
  getPlayer,
  recordInteraction,
  saveNickname,
  adjustTrust,
  setLanguage,
  setTone,
  getContext,
  setBase,
  addChest,
  addWaypoint,
  addKnownAI,
  recordDecision,
  addImprovementNote,
  incrementStat
};