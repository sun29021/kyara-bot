class FarmingSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  async makeFarm(opts = {}) {
    const bot = this.bot;
    const pos = bot.entity.position;
    const size = opts.size || 7;
    bot.chat(`Making a ${size}x${size} farm. Replanting like a responsible adult.`);

    // Place water in center
    const hoe = bot.inventory.items().find(i => i.name.includes('hoe'));
    const water = bot.inventory.items().find(i => i.name === 'water_bucket');

    // Till soil
    if (hoe) {
      await new Promise(r => bot.equip(hoe, 'hand', r));
      for (let x = -size/2; x < size/2; x++) {
        for (let z = -size/2; z < size/2; z++) {
          const block = bot.blockAt(pos.offset(x, 0, z));
          if (block && (block.name === 'grass_block' || block.name === 'dirt')) {
            try {
              await bot.activateBlock(block);
            } catch (e) {}
          }
        }
      }
    }

    // Plant seeds
    const seed = bot.inventory.items().find(i => i.name.includes('seeds'));
    if (seed) {
      await new Promise(r => bot.equip(seed, 'hand', r));
      for (let x = -size/2; x < size/2; x++) {
        for (let z = -size/2; z < size/2; z++) {
          const block = bot.blockAt(pos.offset(x, 0, z));
          if (block && block.name === 'farmland') {
            try { await bot.activateBlock(block); } catch (e) {}
          }
        }
      }
    }

    this.ctx.memory.strategy.farming.activeCrops.push({ location: { x: pos.x, y: pos.y, z: pos.z }, size, crop: 'wheat' });
    bot.chat("Farm set up. Will harvest when ready.");
  }

  async plantCrop(cropName) {
    const bot = this.bot;
    const seed = bot.inventory.items().find(i => i.name.includes(cropName) && i.name.includes('seed')) || bot.inventory.items().find(i => i.name.includes('seeds'));
    if (!seed) {
      bot.chat(`No ${cropName} seeds.`);
      return;
    }
    await new Promise(r => bot.equip(seed, 'hand', r));
    const pos = bot.entity.position;
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const block = bot.blockAt(pos.offset(x, 0, z));
        if (block && block.name === 'farmland') {
          try { await bot.activateBlock(block); } catch (e) {}
        }
      }
    }
    bot.chat(`Planted ${cropName}.`);
  }

  async harvest() {
    const bot = this.bot;
    bot.chat("Harvesting crops.");
    const pos = bot.entity.position;
    let harvested = 0;
    const matureCrops = ['wheat', 'carrots', 'potatoes', 'beetroots'];
    for (let x = -8; x <= 8; x++) {
      for (let z = -8; z <= 8; z++) {
        for (let y = -2; y <= 2; y++) {
          const block = bot.blockAt(pos.offset(x, y, z));
          if (block && matureCrops.includes(block.name)) {
            // Check metadata for maturity (state)
            try {
              this.ctx.inventorySystem.equipBestToolFor(block);
              await bot.collectBlock.collect(block, 1);
              harvested++;
            } catch (e) {}
          }
        }
      }
    }
    this.ctx.memory.strategy.farming.harvestCount += harvested;
    bot.chat(`Harvested ${harvested} crops. Replanting...`);
    // Replant
    const seeds = bot.inventory.items().find(i => i.name === 'wheat_seeds');
    if (seeds) {
      await new Promise(r => bot.equip(seeds, 'hand', r));
      for (let x = -3; x <= 3; x++) {
        for (let z = -3; z <= 3; z++) {
          const block = bot.blockAt(pos.offset(x, 0, z));
          if (block && block.name === 'farmland') {
            try { await bot.activateBlock(block); } catch (e) {}
          }
        }
      }
    }
  }
}

module.exports = FarmingSystem;