const { goals } = require('mineflayer-pathfinder');
const { GoalXZ, GoalY } = goals;

class MiningSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.mining = false; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  async mineOre(oreName, amount = 1) {
    this.mining = true;
    let collected = 0;
    
    const oreMap = {
      'coal': ['coal_ore', 'deepslate_coal_ore'],
      'iron': ['iron_ore', 'deepslate_iron_ore', 'raw_iron_block'],
      'gold': ['gold_ore', 'deepslate_gold_ore'],
      'diamond': ['diamond_ore', 'deepslate_diamond_ore'],
      'emerald': ['emerald_ore', 'deepslate_emerald_ore'],
      'redstone': ['redstone_ore', 'deepslate_redstone_ore'],
      'lapis': ['lapis_ore', 'deepslate_lapis_ore'],
      'copper': ['copper_ore', 'deepslate_copper_ore'],
      'netherite': ['ancient_debris']
    };

    const targetBlocks = oreMap[oreName.toLowerCase()] || [oreName.toLowerCase() + '_ore'];

    while (collected < amount && this.mining) {
      const found = this.findNearestBlock(targetBlocks, 32);
      if (!found) {
        // Silent descend
        await this.descendToMine(oreName);
        break;
      }
      try {
        this.ctx.inventorySystem.equipBestToolFor(found);
        await this.bot.collectBlock.collect(found, 1);
        collected++;
        this.ctx.memory.memory.base.resourcesCollected++;
      } catch (e) {
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    this.mining = false;
    
    // Anti-spam: Only speak once at the very end of the task
    if (collected > 0 && oreName === 'diamond') {
      this.ctx.chatHandler.handleEvent('diamond_found').then(r => { if (r) this.bot.chat(r); });
    }
    return collected;
  }

  findNearestBlock(blockNames, maxDistance = 32) {
    const mcData = require('minecraft-data')(this.bot.version);
    const blockIds = blockNames.map(name => mcData.blocksByName[name]?.id).filter(id => id !== undefined);
    if (blockIds.length === 0) return null;
    
    const found = this.bot.findBlock({
      matching: blockIds,
      maxDistance: maxDistance,
      count: 1
    });
    return found;
  }

  async descendToMine(oreName) {
    const preferredY = this.ctx.memory.strategy.mining.preferredYLevel;
    const currentY = Math.floor(this.bot.entity.position.y);

    if (currentY > preferredY + 5) {
      // Silent digging
      try { this.bot.pathfinder.setGoal(new GoalY(preferredY)); } catch (e) {}
    } else {
      await this.branchMine();
    }
  }

  async branchMine() {
    this.mining = true;
    const pos = this.bot.entity.position;
    const directions = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    
    try { this.bot.pathfinder.setGoal(new GoalXZ(pos.x + dir.x * 30, pos.z + dir.z * 30)); } catch (e) {}
    
    let foundDiamond = false;
    for (let i = 0; i < 30; i++) {
      if (!this.mining) break;
      await new Promise(r => setTimeout(r, 1000));
      const ores = ['diamond_ore', 'deepslate_diamond_ore', 'iron_ore', 'deepslate_iron_ore', 'gold_ore', 'coal_ore', 'deepslate_coal_ore', 'redstone_ore', 'lapis_ore', 'emerald_ore'];
      const ore = this.findNearestBlock(ores, 6);
      if (ore) {
        try {
          this.ctx.inventorySystem.equipBestToolFor(ore);
          await this.bot.collectBlock.collect(ore, 1);
          this.ctx.memory.memory.base.resourcesCollected++;
          if (ore.name.includes('diamond')) foundDiamond = true;
        } catch (e) {}
      }
    }
    this.mining = false;
    // Anti-spam: Only announce if she actually found diamonds during the strip mine
    if (foundDiamond) this.ctx.chatHandler.handleEvent('diamond_found').then(r => { if (r) this.bot.chat(r); });
  }

  async stripMine() {
    const preferredY = this.ctx.memory.strategy.mining.preferredYLevel;
    const pos = this.bot.entity.position;
    if (Math.floor(pos.y) > preferredY + 3) {
      try { this.bot.pathfinder.setGoal(new GoalY(preferredY)); await new Promise(r => setTimeout(r, 8000)); } catch (e) {}
    }
    await this.branchMine();
  }

  async digToY(y) {
    try { this.bot.pathfinder.setGoal(new GoalY(y)); } catch (e) {}
  }

  stop() {
    this.mining = false;
    try { this.bot.pathfinder.setGoal(null); } catch (e) {}
  }
}

module.exports = MiningSystem;