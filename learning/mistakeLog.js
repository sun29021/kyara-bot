class MistakeLog {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.mistakes = []; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.mistakes = []; }

  analyzeDeath(bot) {
    let cause = 'unknown';
    if (bot.lastDamageSource) {
      if (bot.lastDamageSource.entity) cause = bot.lastDamageSource.entity.name || bot.lastDamageSource.entity.displayName || 'entity';
      else if (bot.lastDamageSource.block) cause = bot.lastDamageSource.block.name;
    }

    // Safely get armor names without crashing
    const armorSlots = bot?.inventory?.slots || [];
    const equippedArmor = armorSlots.slice(36, 40).filter(Boolean).map(a => a?.name);

    const mistake = {
      cause, location: bot.entity ? { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z } : null,
      equippedArmor: equippedArmor,
      timestamp: Date.now(), lesson: this.deriveLesson(cause)
    };

    this.mistakes.push(mistake);
    if (this.mistakes.length > 30) this.mistakes = this.mistakes.slice(-30);

    this.ctx.memory.strategy.combat.deathCauses.push(cause);
    this.ctx.memory.memory.survival.confidenceLevel = Math.max(0, this.ctx.memory.memory.survival.confidenceLevel - 8);

    if (cause && !this.ctx.memory.strategy.combat.knownDangerousMobs.includes(cause.toLowerCase())) {
      this.ctx.memory.strategy.combat.knownDangerousMobs.push(cause.toLowerCase());
    }

    this.ctx.memory.addImprovementNote(`Death by ${cause}. Lesson: ${mistake.lesson}`);
  }

  deriveLesson(cause) {
    const lessons = {
      'lava': 'Check for lava before walking in caves',
      'creeper': 'Keep distance from creepers, use bow',
      'zombie': 'Don\'t fight multiple zombies in close quarters',
      'skeleton': 'Use cover against skeleton arrows',
      'fall': 'Watch where I\'m walking, especially at height',
      'player': 'Trust no one in PvP, always carry golden apples'
    };
    return lessons[cause?.toLowerCase()] || `Be more careful around ${cause}`;
  }
}

module.exports = MistakeLog;