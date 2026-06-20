class InventorySystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  describeInventory() {
    const items = this.bot.inventory.items();
    if (items.length === 0) return "I've got nothing. Sad.";
    const grouped = {};
    items.forEach(i => {
      grouped[i.name] = (grouped[i.name] || 0) + i.count;
    });
    return 'Inventory: ' + Object.keys(grouped).map(k => `${k}(${grouped[k]})`).join(', ');
  }

  isFull() {
    return this.bot.inventory.items().length > 35;
  }

  slotsUsed() {
    return this.bot.inventory.items().length;
  }

  countItem(name) {
    return this.bot.inventory.items().filter(i => i.name === name).reduce((sum, i) => sum + i.count, 0);
  }

  hasItem(name) {
    return this.countItem(name) > 0;
  }

  hasToolType(type) {
    // type: pickaxe, axe, shovel, sword, hoe
    return this.bot.inventory.items().some(i => i.name.includes(type));
  }

  getBestToolType(type) {
    const tiers = ['netherite', 'diamond', 'iron', 'golden', 'stone', 'wooden'];
    for (const tier of tiers) {
      const item = this.bot.inventory.items().find(i => i.name === `${tier}_${type}`);
      if (item) return item;
    }
    return null;
  }

  equipBestToolFor(block) {
    const bot = this.bot;
    const toolType = this.toolForBlock(block);
    if (!toolType) return;
    const tool = this.getBestToolType(toolType);
    if (tool) {
      bot.equip(tool, 'hand', () => {});
    }
  }

  toolForBlock(block) {
    if (!block) return null;
    const name = block.name || '';
    if (/pickaxe/.test(name) || /(ore|stone|cobblestone|deepslate|granite|diorite|andesite|obsidian|netherrack|basalt|brick)/.test(name)) return 'pickaxe';
    if (/log|wood|plank|leaves|plant/.test(name)) return 'axe';
    if (/dirt|grass|sand|gravel|snow/.test(name)) return 'shovel';
    return null;
  }

  sortInventory() {
    const bot = this.bot;
    const items = bot.inventory.items().slice();
    // tools/weapons first, food, blocks, misc
    const priority = (item) => {
      if (item.name.includes('sword')) return 0;
      if (item.name.match(/pickaxe|axe|shovel|hoe/)) return 1;
      if (item.food) return 2;
      if (item.name.includes('torch')) return 3;
      if (item.name.match(/log|planks|cobblestone|dirt/)) return 4;
      return 5;
    };
    items.sort((a, b) => priority(a) - priority(b));
    // note: mineflayer doesn't really support inventory slot rearrangement easily; this is a logical placeholder
    bot.chat("Sorted my inventory in my head. Maybe one day I'll actually move things.");
  }

  giveItem(playerName, itemName) {
    const bot = this.bot;
    const item = bot.inventory.items().find(i => i.name === itemName || i.displayName.toLowerCase().includes(itemName.toLowerCase()));
    if (!item) {
      bot.chat(`I don't have any ${itemName}.`);
      return;
    }
    const player = bot.players[playerName];
    if (!player || !player.entity) {
      bot.chat(`Can't see ${playerName}.`);
      return;
    }
    bot.tossStack(item, () => {
      bot.chat(`Dropped ${item.count} ${item.name}. Don't say I never gave you anything.`);
    });
  }

  countStashItem(name) {
    return this.ctx.memory.memory.inventory.stash[name] || 0;
  }

  addToStash(name, count) {
    const stash = this.ctx.memory.memory.inventory.stash;
    stash[name] = (stash[name] || 0) + count;
    this.ctx.memory.memory.inventory.totalItems += count;
  }

  removeFromStash(name, count) {
    const stash = this.ctx.memory.memory.inventory.stash;
    if (!stash[name]) return 0;
    const taken = Math.min(stash[name], count);
    stash[name] -= taken;
    if (stash[name] <= 0) delete stash[name];
    return taken;
  }

  hasEssentials() {
    return {
      sword: this.hasToolType('sword'),
      pickaxe: this.hasToolType('pickaxe'),
      food: this.findBestFood() !== null,
      torches: this.countItem('torch') >= 8,
      wood: this.countItem('oak_log') + this.countItem('spruce_log') + this.countItem('birch_log') + this.countItem('planks') >= 16
    };
  }

  findBestFood() {
    const bot = this.bot;
    const foods = ['cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_cod', 'cooked_salmon', 'bread', 'apple', 'golden_apple', 'beef', 'porkchop', 'chicken', 'mutton', 'cod', 'salmon', 'carrot', 'baked_potato'];
    for (const f of foods) {
      const item = bot.inventory.items().find(i => i.name === f);
      if (item) return item;
    }
    return bot.inventory.items().find(i => i && i.food);
  }

  getMissingEssentials() {
    const e = this.hasEssentials();
    return Object.keys(e).filter(k => !e[k]);
  }
}

module.exports = InventorySystem;