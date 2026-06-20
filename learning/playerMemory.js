const personality = require('../core/kyaraPersonality');

class PlayerMemory {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  onPlayerJoin(playerName) {
    const p = this.ctx.memory.getPlayer(playerName);
    if (playerName === this.ctx.settings.ownerName) {
      p.isOwner = true;
      p.trust = Math.max(p.trust, 50);
    }
    console.log(`[KYARA PLAYER] ${playerName} joined. Trust: ${p.trust}, Language: ${p.language}`);
  }

  onPlayerMessage(playerName, message) {
    const p = this.ctx.memory.getPlayer(playerName);
    const lang = personality.detectLanguage(message);
    const tone = personality.detectTone(message);
    p.language = lang;
    p.tone = tone;

    // Trust adjustments
    if (tone === 'toxic') {
      this.ctx.memory.adjustTrust(playerName, -1, 'toxic');
    } else if (tone === 'friendly') {
      this.ctx.memory.adjustTrust(playerName, +1, 'friendly');
    }

    // Track slang/new words
    const words = message.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !p.likes.includes(w) && !p.dislikes.includes(w)) {
        // Track vocabulary
      }
    }
  }

  onPlayerAttack(playerName) {
    this.ctx.memory.adjustTrust(playerName, -10, 'attacked me');
    const p = this.ctx.memory.getPlayer(playerName);
    p.isHostile = true;
    this.ctx.memory.memory.survival.confidenceLevel = Math.max(0, this.ctx.memory.memory.survival.confidenceLevel - 5);
  }

  onPlayerHelp(playerName) {
    this.ctx.memory.adjustTrust(playerName, +5, 'helped me');
  }

  isAlly(playerName) {
    return this.ctx.memory.getPlayer(playerName).isAlly;
  }

  isOwner(playerName) {
    return playerName === this.ctx.settings.ownerName;
  }

  isHostile(playerName) {
    return this.ctx.memory.getPlayer(playerName).isHostile;
  }
}

module.exports = PlayerMemory;