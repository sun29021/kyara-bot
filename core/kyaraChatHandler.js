const personality = require('./kyaraPersonality');
const kyaraAI = require('./kyaraAI');
const memory = require('./kyaraMemory');

class KyaraChatHandler {
  constructor() {
    this.chatHistory = [];
    this.responseCache = new Map();
    this.followTarget = null;
    this.eventCooldowns = { death: 0, damage: 0, mob: 0, mining: 0, building: 0, low_health: 0 };
    this.lastResponseTime = 0;
  }

  setBot(bot, ctx) {
    this.bot = bot;
    this.ctx = ctx; // contains systems & learning
  }

  async handlePlayerChat(playerName, message) {
    if (!this.bot) return;
    this.chatHistory.push({ username: playerName, message, t: Date.now() });
    if (this.chatHistory.length > 20) this.chatHistory.shift();

    try {
      // Detect language and tone
      const lang = personality.detectLanguage(message);
      const tone = personality.detectTone(message);
      memory.setLanguage(playerName, lang);
      memory.setTone(playerName, tone);

      const ctx = memory.getContext(playerName);
      if (ctx.isOwner === undefined) ctx.isOwner = playerName === this.bot.settings.ownerName;

      // Mark owner
      if (playerName === this.bot.settings.ownerName) {
        const p = memory.getPlayer(playerName);
        p.isOwner = true;
      }

      // Trust adjustments based on tone
      if (tone === 'toxic') memory.adjustTrust(playerName, -1, 'toxic message');
      if (tone === 'friendly') memory.adjustTrust(playerName, +1, 'friendly message');

      // 1. Commands
      if (message.startsWith('!')) {
        const resp = this.handleCommand(playerName, message);
        memory.recordInteraction(playerName, message, resp);
        return resp;
      }

      // 2. Action intent
      const intent = await kyaraAI.classifyIntent(message);
      if (intent.type !== 'chat') {
        const actionResp = await this.handleActionIntent(playerName, message, intent);
        if (actionResp !== null) {
          memory.recordInteraction(playerName, message, actionResp);
          return actionResp;
        }
      }

      // 3. Nickname setting
      const nameMatch = message.match(/my name is (\w+)|call me (\w+)|ami (\w+)|amake (\w+) dako|amake (\w+) bolo/i);
      if (nameMatch) {
        const nick = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4] || nameMatch[5];
        memory.saveNickname(playerName, nick);
        const resp = `Got it, I'll call you ${nick} 😏`;
        memory.recordInteraction(playerName, message, resp);
        return resp;
      }

      // 4. Quick responses for common situations
      const situation = this.detectSituation(message);
      if (situation && Math.random() > 0.4) {
        const resp = this.getQuickResponse(situation, playerName);
        memory.recordInteraction(playerName, message, resp);
        return resp;
      }

      // 5. Full Groq response
      const recent = this.chatHistory.slice(-5);
      const resp = await kyaraAI.generateResponse(playerName, message, ctx, recent);
      memory.recordInteraction(playerName, message, resp);
      return resp;
    } catch (e) {
      console.log('[KYARA CHAT] Error:', e.message);
      return "Eh something broke, my bad 😅";
    }
  }

  handleCommand(playerName, message) {
    const bot = this.bot;
    const cmd = message.slice(1).toLowerCase().split(' ')[0];
    const p = memory.getPlayer(playerName);

    switch (cmd) {
      case 'status': {
        const hp = bot.health ? bot.health.toFixed(1) : '?';
        const food = bot.food ? bot.food.toFixed(1) : '?';
        const conf = memory.memory.survival.confidenceLevel;
        return `HP: ${hp}/20 | Food: ${food}/20 | Confidence: ${conf}/100 | Pos: ${bot.entity.position.x.toFixed(0)},${bot.entity.position.y.toFixed(0)},${bot.entity.position.z.toFixed(0)}`;
      }
      case 'base': {
        const b = memory.memory.base;
        if (!b.built) return "No base yet. Working on it.";
        return `Base: ${b.type} at ${b.location.x},${b.location.y},${b.location.z} | Next upgrade: ${b.nextUpgrade} | Chests: ${b.chestLocations.length}`;
      }
      case 'inventory': {
        if (!this.ctx?.inventorySystem) return "Inventory not ready.";
        return this.ctx.inventorySystem.describeInventory();
      }
      case 'stash': {
        const stash = memory.memory.inventory.stash;
        const keys = Object.keys(stash);
        if (keys.length === 0) return "Stash is empty.";
        return 'Stash: ' + keys.map(k => `${k}(${stash[k]})`).join(', ');
      }
      case 'strategy': {
        const s = memory.strategy;
        return `Mining Y=${s.mining.preferredYLevel} (${s.mining.currentTactic}) | Combat: ${s.combat.preferredTactic} aggro ${s.combat.aggressiveness} | Build: ${s.building.preferredMaterial}`;
      }
      case 'learn': {
        const s = memory.strategy;
        return `Known mobs: ${s.combat.knownDangerousMobs.join(',')} | Mining runs: ${s.mining.successfulRuns} | PvP W/L: ${s.combat.pvpWins}/${s.combat.pvpLosses}`;
      }
      case 'knowledge': {
        return `Decisions logged: ${s_decisionsCount()} | Improvement notes: ${memory.strategy.decisions.improvementNotes.length}`;
      }
      case 'confidence': {
        return `Confidence: ${memory.memory.survival.confidenceLevel}/100`;
      }
      case 'stats': {
        return `${p.nickname || playerName}: ${p.messageCount} msgs, trust ${p.trust}, language ${p.language}, tone ${p.tone}`;
      }
      case 'where': {
        const b = memory.memory.base;
        return b.built ? `Base at ${b.location.x},${b.location.y},${b.location.z}` : "No base yet.";
      }
      case 'help': {
        return "Commands: !status !base !inventory !stash !strategy !learn !knowledge !confidence !stats !where !help";
      }
      default:
        return "Unknown command. Try !help";
    }
  }

  async handleActionIntent(playerName, message, intent) {
    const bot = this.bot;
    const ctx = this.ctx;
    const isOwner = playerName === bot.settings.ownerName;
    const p = memory.getPlayer(playerName);
    const canCommand = isOwner || p.trust > 0;

    if (!canCommand && intent.type !== 'chat') {
      return "Why would I do that for you? Earn it first.";
    }

    switch (intent.type) {
      case 'move_come': {
        ctx.movementSystem.comeToPlayer(playerName);
        return "On my way. Don't die before I get there.";
      }
      case 'follow': {
        ctx.movementSystem.followPlayer(playerName);
        return "Following. Try not to lose me.";
      }
      case 'stop': {
        ctx.movementSystem.stop();
        ctx.taskSystem.cancelCurrent();
        return "Fine. Stopped.";
      }
      case 'goto': {
        const coords = message.match(/(-?\d+)[\s,]+(-?\d+)[\s,]+(-?\d+)/);
        if (coords) {
          ctx.movementSystem.goto(parseInt(coords[1]), parseInt(coords[2]), parseInt(coords[3]));
          return `Heading to ${coords[1]},${coords[2]},${coords[3]}.`;
        }
        const target = message.replace(/.*go to\s*/i, '').replace(/.*goto\s*/i, '').trim();
        const ent = Object.values(bot.entities).find(e => e.username && e.username.toLowerCase() === target.toLowerCase());
        if (ent) {
          ctx.movementSystem.followPlayer(ent.username);
          return `Going to ${target}.`;
        }
        return "Where exactly? Give coords or a name.";
      }
      case 'combat': {
        const target = message.replace(/.*(kill|attack|fight)\s*/i, '').trim();
        ctx.combatSystem.engageTarget(target);
        return `Engaging ${target}. Watch this.`;
      }
      case 'defend': {
        ctx.combatSystem.defendPlayer(playerName);
        return "I've got your back. Don't wander off.";
      }
      case 'mine': {
        const oreMatch = message.match(/(\d+)\s+(\w+)/);
        const amount = oreMatch ? parseInt(oreMatch[1]) : 1;
        const ore = oreMatch ? oreMatch[2] : message.replace(/.*(mine|get me|find)\s*/i, '').trim();
        ctx.taskSystem.startTask({ type: 'mine', ore, amount, requester: playerName });
        return `Mining ${amount} ${ore}. Don't wait up.`;
      }
      case 'stripmine': {
        ctx.taskSystem.startTask({ type: 'stripmine', requester: playerName });
        return "Branch mining at Y=-59. Standard protocol.";
      }
      case 'dig': {
        const yMatch = message.match(/y\s*=?\s*(-?\d+)/i);
        const y = yMatch ? parseInt(yMatch[1]) : -59;
        ctx.taskSystem.startTask({ type: 'dig', y, requester: playerName });
        return `Digging down to Y=${y}. Careful of lava.`;
      }
      case 'craft': {
        let item = message.replace(/.*(craft|make me|make a|make)\s*/i, '').trim();
        // Strip trailing filler clauses so "make a pickaxe and give it to me"
        // doesn't end up trying to craft an item literally named that whole phrase
        item = item.replace(/\s*(and\s+)?(give|hand|drop|pass)\s+(it|them|that|those)?\s*(to|for)?\s*(me|us)?\.?$/i, '').trim();
        item = item.replace(/\s*(please|pls|for me|thanks|thank you)\.?$/i, '').trim();
        ctx.taskSystem.startTask({ type: 'craft', item, requester: playerName });
        return `Crafting ${item}. Give me a sec.`;
      }
      case 'build': {
        const sizeMatch = message.match(/(\d+)\s*(?:by|x)\s*(\d+)/i);
        const w = sizeMatch ? parseInt(sizeMatch[1]) : 7;
        const l = sizeMatch ? parseInt(sizeMatch[2]) : 7;
        const matMatch = message.match(/(dirt|wood|stone|cobblestone|oak|spruce|birch|deepslate|netherite)/i);
        const mat = matMatch ? matMatch[1] : null;
        const typeMatch = message.match(/(base|hut|house|wall|tower|farm|shelter)/i);
        const btype = typeMatch ? typeMatch[1] : 'base';
        ctx.taskSystem.startTask({ type: 'build', buildType: btype, material: mat, width: w, length: l, requester: playerName });
        return `Building a ${w}x${l} ${bTypeLabel(btype, mat)}. This better be worth it.`;
      }
      case 'farm': {
        const crop = message.replace(/.*(plant|farm)\s*/i, '').trim() || 'wheat';
        ctx.taskSystem.startTask({ type: 'farm', crop, requester: playerName });
        return `Farming ${crop}. Replanting because I'm responsible like that.`;
      }
      case 'harvest': {
        ctx.taskSystem.startTask({ type: 'harvest', requester: playerName });
        return "Harvesting crops.";
      }
      case 'give': {
        const item = message.replace(/.*(give me|drop)\s*/i, '').trim();
        ctx.inventorySystem.giveItem(playerName, item);
        return `Dropping ${item} if I have it.`;
      }
      case 'deposit': {
        ctx.taskSystem.startTask({ type: 'deposit', requester: playerName });
        return "Heading to base to stash stuff.";
      }
      case 'inventory': {
        return ctx.inventorySystem.describeInventory();
      }
      case 'eat': {
        ctx.survivalSystem.eatNow();
        return "Eating. Don't judge.";
      }
      case 'sleep': {
        ctx.survivalSystem.sleepNow();
        return "Going to sleep. Don't do anything stupid while I'm gone.";
      }
      case 'explore': {
        ctx.taskSystem.startTask({ type: 'explore', requester: playerName });
        return "Going exploring. I'll bring back something useful.";
      }
      case 'findstructure': {
        ctx.taskSystem.startTask({ type: 'findstructure', structure: 'village', requester: playerName });
        return "Looking for a structure. Could take a while.";
      }
      default:
        return null;
    }
  }

  detectSituation(message) {
    const m = message.toLowerCase();
    if (/^(hi|hey|hello|yo|sup|hola|salam|assalam)\b/.test(m)) return 'greeting';
    if (/help me|can you help|need help/.test(m)) return 'help_request';
    if (/(thank|thanks|tysm|appreciate|good job|nice work|well done)/.test(m)) return 'compliment';
    if (/(stupid|idiot|noob|trash|dumb|useless|suck|loser)/.test(m)) return 'insult';
    if (/(who are you\??$|what are you\??$|are you a bot|are you ai|are you real|are you alive)/.test(m)) return 'question_self';
    if (/(bye|goodbye|cya|later|gtg)/.test(m)) return 'goodbye';
    return null;
  }

  getQuickResponse(situation, playerName) {
    const arr = personality.QUICK_RESPONSES[situation] || ['...'];
    let resp = personality.pickRandom(arr);
    const ctx = memory.getContext(playerName);
    if (ctx.isOwner && situation === 'greeting') resp = "Oh you're here. Finally.";
    if (ctx.nickname) resp = resp.replace(playerName, ctx.nickname);
    return resp;
  }

  async handleEvent(event, data = {}) {
    const now = Date.now();
    const cooldowns = { death: 60000, damage: 20000, mob: 25000, mining: 15000, building: 10000, low_health: 60000 };
    if (this.eventCooldowns[event] && now - this.eventCooldowns[event] < cooldowns[event]) return null;
    this.eventCooldowns[event] = now;

    let resp;
    const conf = memory.memory.survival.confidenceLevel;
    switch (event) {
      case 'death':
        memory.memory.meta.deathCount++;
        resp = "Nah I'm not out, I'll be back.";
        break;
      case 'low_health':
        resp = "Gotta find food NOW.";
        break;
      case 'diamond_found':
        resp = "DIAMONDS!! Going straight in my collection 💎";
        memory.memory.survival.confidenceLevel = Math.min(100, conf + 5);
        break;
      case 'mob_dangerous':
        resp = conf > 60 ? "Time for a fight." : "Nope, bouncing!";
        break;
      case 'base_built':
        resp = "Finally. My territory. 🏠";
        break;
      case 'task_done':
        resp = "Done. Was that supposed to be hard?";
        break;
      case 'task_failed':
        resp = "Okay that didn't work. Trying something else.";
        break;
      case 'pvp_win':
        resp = "That's what I thought. Don't try me again.";
        memory.strategy.combat.pvpWins++;
        memory.memory.survival.confidenceLevel = Math.min(100, conf + 3);
        break;
      case 'pvp_loss':
        resp = "Okay that was actually decent. Enjoy it. Won't happen again.";
        memory.strategy.combat.pvpLosses++;
        break;
      case 'player_joins':
        resp = `Oh look, ${data.playerName} showed up.`;
        break;
      default:
        return null;
    }
    return resp;
  }

  maybeRandomThought() {
    if (Math.random() < 0.15) {
      return personality.getRandomThought();
    }
    return null;
  }
}

function s_decisionsCount() {
  return memory.strategy.decisions.log.length;
}
function bTypeLabel(t, m) {
  return (m ? m + ' ' : '') + t;
}

module.exports = KyaraChatHandler;