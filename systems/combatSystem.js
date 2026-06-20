class CombatSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.defending = null; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  engageTarget(targetName) {
    const bot = this.bot;
    const lower = targetName.toLowerCase();

    // Check player first
    const player = bot.players[targetName];
    if (player && player.entity) {
      this.attackEntity(player.entity, 'player');
      return;
    }

    // Check mobs
    const mob = Object.values(bot.entities).find(e =>
      e.mobType && e.mobType.toLowerCase().includes(lower)
    );
    if (mob) {
      this.attackEntity(mob, 'mob');
      return;
    }

    // Check any entity by name
    const ent = Object.values(bot.entities).find(e => e.username && e.username.toLowerCase() === lower);
    if (ent) {
      this.attackEntity(ent, 'entity');
      return;
    }

    bot.chat(`Can't find any ${targetName} to fight.`);
  }

  async attackEntity(entity, type) {
    const bot = this.bot;
    // Equip best weapon
    const sword = this.ctx.inventorySystem.getBestToolType('sword');
    if (sword) {
      await new Promise(r => bot.equip(sword, 'hand', r));
    }

    // Health check
    if (bot.health < this.ctx.memory.strategy.combat.retreatThreshold) {
      bot.chat("Too low HP. Retreating.");
      this.ctx.survivalSystem.flee();
      return;
    }

    try {
      bot.pvp.attack(entity);
    } catch (e) {}

    // Anti-spam: Only announce when the target is actually dead
    bot.once('entityDead', (dead) => {
      if (dead === entity) {
        bot.chat(`YESSS just destroyed that ${entity.mobType || entity.username}! Getting STRONGER 💪`);
        this.ctx.memory.strategy.combat.pvpWins++;
      }
    });
  }

  defendPlayer(playerName) {
    const bot = this.bot;
    this.defending = playerName;
    const loop = () => {
      if (this.defending !== playerName) return;
      const player = bot.players[playerName];
      if (!player || !player.entity) {
        this.defending = null;
        return;
      }
      // Follow
      try {
        bot.pathfinder.setGoal(new (require('mineflayer-pathfinder').goals.GoalFollow)(player.entity, 3), true);
      } catch (e) {}
      // Attack hostiles near player
      const hostiles = Object.values(bot.entities).filter(e =>
        e.mobType && player.entity.position.distanceTo(e.position) < 8 &&
        ['Zombie', 'Skeleton', 'Creeper', 'Spider', 'Enderman', 'Witch', 'Blaze', 'Pillager', 'Vindicator', 'Evoker', 'Ravager'].includes(e.mobType)
      );
      if (hostiles.length > 0) {
        try { bot.pvp.attack(hostiles[0]); } catch (e) {}
      }
      setTimeout(loop, 2000);
    };
    loop();
  }

  stopCombat() {
    try { this.bot.pvp.stop(); } catch (e) {}
    this.defending = null;
  }
}

module.exports = CombatSystem;