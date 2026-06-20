class GoalScheduler {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.running = false; this.lastAction = null; this.lastSpoken = 0; this.craftingCooldown = 0; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; }

  start() {
    if (this.running) return;
    this.running = true;
    setInterval(() => this.tick(), 5000);
    console.log('[KYARA] Goal scheduler started.');
  }

  tick() {
    if (!this.bot.entity) return;
    try { this.handlePriority(this.assessPriority()); } catch (e) {}
  }

  assessPriority() {
    const bot = this.bot;
    if (bot.health < 4) return 'flee_and_heal';
    if (bot.food < 6) return 'eat';
    if (this.ctx.survivalSystem.isNight() && !bot.inventory.items().find(i => i.name.includes('bed'))) return 'shelter';
    if (this.ctx.inventorySystem.slotsUsed() > 32) return 'deposit';
    const missing = this.ctx.inventorySystem.getMissingEssentials();
    if (missing.includes('pickaxe') || missing.includes('sword')) return 'craft_tools';
    if (this.ctx.taskSystem.currentTask) return 'task';
    if (!this.ctx.memory.memory.base.built) return 'build_base';
    return 'explore';
  }

  handlePriority(action) {
    const bot = this.bot;
    const now = Date.now();
    
    // Anti-spam: Only announce action changes once every 60 seconds
    if (action !== this.lastAction || now - this.lastSpoken > 60000) {
      this.lastAction = action;
      this.lastSpoken = now;
      
      if (action === 'shelter') bot.chat("Night time. No bed. Finding shelter.");
      else if (action === 'build_base' && !this.ctx.memory.memory.base.built) bot.chat("No base. Building one. Dirt for now.");
    }

    switch (action) {
      case 'flee_and_heal': this.ctx.survivalSystem.flee(); this.ctx.survivalSystem.eatNow(); break;
      case 'eat': if (!this.ctx.survivalSystem.eatNow()) this.ctx.survivalSystem.huntFood(); break;
      case 'shelter': this.ctx.movementSystem.explore(20); break;
      case 'deposit': if (!this.ctx.taskSystem.currentTask) this.ctx.taskSystem.startTask({ type: 'deposit', requester: bot.username }); break;
      case 'craft_tools': 
        // Only attempt crafting every 2 minutes to prevent spam
        if (now - this.craftingCooldown > 120000) {
          this.craftingCooldown = now;
          this.craftEssentialTools();
        }
        break;
      case 'build_base': if (!this.ctx.taskSystem.currentTask) this.ctx.taskSystem.startTask({ type: 'build', buildType: 'base', material: 'dirt', width: 7, length: 7, requester: bot.username }); break;
      case 'explore': if (!this.ctx.taskSystem.currentTask && Math.random() < 0.2) this.ctx.movementSystem.explore(12); break;
    }
  }

  async craftEssentialTools() {
    const bot = this.bot;
    const mcData = require('minecraft-data')(bot.version);
    
    if (!bot.inventory.items().some(i => i.name.endsWith('_log'))) {
      const log = this.ctx.buildSystem.findSurfaceBlock('oak_log', 16) || this.ctx.buildSystem.findSurfaceBlock('birch_log', 16);
      if (log) { try { await bot.collectBlock.collect(log, 4); } catch (e) {} }
    }

    const logs = bot.inventory.items().filter(i => i.name.endsWith('_log'));
    if (logs.length > 0) {
      try {
        const plankRecipe = bot.recipesAll(mcData.itemsByName.oak_planks?.id || 5, null, null);
        if (plankRecipe && plankRecipe.length > 0) await bot.craft(plankRecipe[0], 4, null);
      } catch (e) {}
    }

    try {
      const stickRecipe = bot.recipesFor(mcData.itemsByName.stick.id)[0];
      if (stickRecipe) await bot.craft(stickRecipe, 4, null);
    } catch (e) {}

    try {
      const tableRecipe = bot.recipesFor(mcData.itemsByName.crafting_table.id)[0];
      if (tableRecipe) await bot.craft(tableRecipe, 1, null);
    } catch (e) {}

    if (!this.ctx.inventorySystem.hasToolType('pickaxe')) {
      try {
        const pickRecipe = bot.recipesFor(mcData.itemsByName.wooden_pickaxe.id)[0];
        if (pickRecipe) {
          const table = bot.findBlock({ matching: mcData.itemsByName.crafting_table.id, maxDistance: 6 });
          await bot.craft(pickRecipe, 1, table);
          bot.chat("Crafted a wooden pickaxe. Upgrades coming.");
        }
      } catch (e) {}
    }
  }
}

module.exports = GoalScheduler;