const Vec3 = require('vec3');

class BuildSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  async buildBase(opts = {}) {
    const bot = this.bot;
    const { material = 'dirt', width = 7, length = 7, height = 3 } = opts;

    const matBlock = material.endsWith('_planks') ? material : (material === 'wood' ? 'oak_planks' : material);
    const requiredCount = width * length + (width + length) * 2 * height;

    bot.chat(`Building a ${width}x${length} ${material} base. Need ~${requiredCount} blocks.`);

    // Gather materials if needed
    const have = this.ctx.inventorySystem.countItem(matBlock);
    if (have < requiredCount) {
      bot.chat(`Only have ${have} ${matBlock}. Gathering more...`);
      await this.gatherMaterial(material, requiredCount - have);
    }

    // Find flat location
    const loc = bot.entity.position;
    const basePos = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };

    try {
      // Build floor
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < length; z++) {
          await this.placeBlockAt(basePos.x + x, basePos.y, basePos.z + z, matBlock);
        }
      }

      // Build walls
      for (let h = 1; h <= height; h++) {
        for (let x = 0; x < width; x++) {
          await this.placeBlockAt(basePos.x + x, basePos.y + h, basePos.z, matBlock);
          await this.placeBlockAt(basePos.x + x, basePos.y + h, basePos.z + length - 1, matBlock);
        }
        for (let z = 0; z < length; z++) {
          await this.placeBlockAt(basePos.x, basePos.y + h, basePos.z + z, matBlock);
          await this.placeBlockAt(basePos.x + width - 1, basePos.y + h, basePos.z + z, matBlock);
        }
      }

      // Doorway on south side (z = length-1) - remove two blocks
      // (We don't actually remove, we just skip placing them — but easier: leave gap)
      // For simplicity, place door item if available
      const door = bot.inventory.items().find(i => i.name.includes('door'));
      if (door) {
        const doorPos = bot.blockAt(new Vec3(basePos.x + Math.floor(width/2), basePos.y + 1, basePos.z + length - 1));
        // Place door
      }

      // Place crafting table
      const table = bot.inventory.items().find(i => i.name === 'crafting_table');
      if (table) {
        await this.placeBlockAt(basePos.x + 1, basePos.y + 1, basePos.z + 1, 'crafting_table');
      }

      // Place chest
      const chest = bot.inventory.items().find(i => i.name === 'chest');
      if (chest) {
        await this.placeBlockAt(basePos.x + 2, basePos.y + 1, basePos.z + 1, 'chest');
        this.ctx.memory.addChest({ x: basePos.x + 2, y: basePos.y + 1, z: basePos.z + 1 }, 'misc');
        this.ctx.memory.addChest({ x: basePos.x + 3, y: basePos.y + 1, z: basePos.z + 1 }, 'ores');
        this.ctx.memory.addChest({ x: basePos.x + 4, y: basePos.y + 1, z: basePos.z + 1 }, 'food');
        this.ctx.memory.addChest({ x: basePos.x + 5, y: basePos.y + 1, z: basePos.z + 1 }, 'building');
      }

      // Place torch
      const torch = bot.inventory.items().find(i => i.name === 'torch');
      if (torch) {
        await this.placeBlockAt(basePos.x + Math.floor(width/2), basePos.y + 2, basePos.z + Math.floor(length/2), 'torch');
      }
    } catch (e) {
      console.log('[KYARA BUILD] Error:', e.message);
      bot.chat("Build failed. Ugh.");
      this.ctx.memory.strategy.building.failedBuilds.push({ type: 'base', material, error: e.message });
      return false;
    }

    this.ctx.memory.setBase(basePos, `${material}_base`);
    this.ctx.memory.strategy.building.completedBuilds.push({ type: 'base', material, size: `${width}x${length}`, location: basePos });
    this.ctx.memory.memory.survival.confidenceLevel = Math.min(100, this.ctx.memory.memory.survival.confidenceLevel + 10);
    this.ctx.chatHandler.handleEvent('base_built').then(r => { if (r) bot.chat(r); });
    return true;
  }

  async placeBlockAt(x, y, z, blockName) {
    const bot = this.bot;
    const target = bot.blockAt(new Vec3(x, y, z));
    if (target && target.name !== 'air') return;

    const item = bot.inventory.items().find(i => i.name === blockName);
    if (!item) return;

    return new Promise((resolve) => {
      bot.equip(item, 'hand', () => {
        // Find a face to place against
        const dirs = [new Vec3(0, -1, 0), new Vec3(0, 1, 0), new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)];
        for (const d of dirs) {
          const adj = bot.blockAt(new Vec3(x, y, z).plus(d));
          if (adj && adj.name !== 'air') {
            try {
              bot.placeBlock(adj, d.scaled(-1), () => resolve());
              return;
            } catch (e) {}
          }
        }
        resolve();
      });
    });
  }

  async gatherMaterial(material, count) {
    const bot = this.bot;
    if (material === 'dirt') {
      const dirt = this.findSurfaceBlock('dirt', 16);
      if (dirt) {
        for (let i = 0; i < Math.min(count, 20); i++) {
          try {
            this.ctx.inventorySystem.equipBestToolFor(dirt);
            await bot.collectBlock.collect(dirt, 1);
          } catch (e) { break; }
        }
      }
    } else if (material === 'wood' || material === 'oak_planks' || material.includes('_planks')) {
      const log = this.findSurfaceBlock('oak_log', 32) || this.findSurfaceBlock('birch_log', 32) || this.findSurfaceBlock('spruce_log', 32);
      if (log) {
        for (let i = 0; i < Math.min(count, 12); i++) {
          try {
            this.ctx.inventorySystem.equipBestToolFor(log);
            await bot.collectBlock.collect(log, 1);
          } catch (e) { break; }
        }
        // Craft planks
        await this.craftPlanks();
      }
    } else if (material === 'stone' || material === 'cobblestone') {
      const stone = this.findSurfaceBlock('stone', 32);
      if (stone) {
        for (let i = 0; i < Math.min(count, 20); i++) {
          try {
            this.ctx.inventorySystem.equipBestToolFor(stone);
            await bot.collectBlock.collect(stone, 1);
          } catch (e) { break; }
        }
      }
    }
  }

  findSurfaceBlock(name, maxDistance = 16) {
    const mcData = require('minecraft-data')(this.bot.version);
    const blockId = mcData.blocksByName[name]?.id;
    if (!blockId) return null;
    
    // Use native fast chunk scanning
    const found = this.bot.findBlock({
      matching: blockId,
      maxDistance: maxDistance,
      count: 1
    });
    return found;
  }

  async craftPlanks() {
    const bot = this.bot;
    const logs = bot.inventory.items().filter(i => i.name.endsWith('_log'));
    if (logs.length === 0) return;
    const mcData = require('minecraft-data')(bot.version);
    try {
      const recipe = bot.recipesFor(mcData.itemsByName.oak_planks ? mcData.itemsByName.oak_planks.id : 5)[0];
      if (recipe) {
        await bot.craft(recipe, 4, null);
      }
    } catch (e) {
      console.log('[KYARA BUILD] craftPlanks error:', e.message);
    }
  }

  async buildStructure(type, opts = {}) {
    switch (type) {
      case 'base':
      case 'hut':
      case 'house':
      case 'shelter':
        return this.buildBase(opts);
      case 'wall':
        return this.buildWall(opts);
      case 'tower':
        return this.buildTower(opts);
      case 'farm':
        return this.ctx.farmingSystem.makeFarm(opts);
      default:
        return this.buildBase(opts);
    }
  }

  async buildWall(opts = {}) {
    const bot = this.bot;
    const { material = 'cobblestone', length = 10, height = 3 } = opts;
    const pos = bot.entity.position;
    for (let i = 0; i < length; i++) {
      for (let h = 0; h < height; h++) {
        await this.placeBlockAt(pos.x + i, pos.y + h, pos.z, material);
      }
    }
    bot.chat(`Wall done. ${length}x${height} ${material}.`);
  }

  async buildTower(opts = {}) {
    const bot = this.bot;
    const { material = 'cobblestone', height = 10 } = opts;
    const pos = bot.entity.position;
    for (let h = 0; h < height; h++) {
      await this.placeBlockAt(pos.x, pos.y + h, pos.z, material);
      await this.placeBlockAt(pos.x + 1, pos.y + h, pos.z, material);
      await this.placeBlockAt(pos.x, pos.y + h, pos.z + 1, material);
      await this.placeBlockAt(pos.x + 1, pos.y + h, pos.z + 1, material);
    }
    // Torch on top
    const torch = bot.inventory.items().find(i => i.name === 'torch');
    if (torch) {
      await this.placeBlockAt(pos.x, pos.y + height, pos.z, 'torch');
    }
    bot.chat(`Tower done. ${height} blocks tall. Beacon of dominance.`);
  }
}

module.exports = BuildSystem;