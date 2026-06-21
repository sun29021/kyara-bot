class TaskSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.currentTask = null; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  startTask(task) {
    if (this.currentTask) {
      this.bot.chat("Already busy. Wait your turn.");
      return;
    }
    this.currentTask = task;
    this.executeTask(task);
  }

  cancelCurrent() {
    if (this.currentTask) {
      this.currentTask = null;
      this.ctx.movementSystem.stop();
      this.ctx.combatSystem.stopCombat();
      this.ctx.miningSystem.stop();
      this.bot.chat("Task cancelled.");
    }
  }

  async executeTask(task) {
    const bot = this.bot;
    try {
      switch (task.type) {
        case 'mine': {
          const count = await this.ctx.miningSystem.mineOre(task.ore, task.amount || 1);
          this.reportResult(task, count > 0, `Mined ${count} ${task.ore}.`);
          break;
        }
        case 'stripmine': {
          await this.ctx.miningSystem.stripMine();
          this.reportResult(task, true, "Strip mining done.");
          break;
        }
        case 'dig': {
          await this.ctx.miningSystem.digToY(task.y);
          this.reportResult(task, true, `Dug to Y=${task.y}.`);
          break;
        }
        case 'craft': {
          const ok = await this.craftItem(task.item);
          this.reportResult(task, ok, ok ? `Crafted ${task.item}.` : `Couldn't craft ${task.item}.`);
          break;
        }
        case 'build': {
          const ok = await this.ctx.buildSystem.buildStructure(task.buildType, { material: task.material, width: task.width, length: task.length });
          this.reportResult(task, ok, ok ? "Build complete." : "Build failed.");
          break;
        }
        case 'farm': {
          await this.ctx.farmingSystem.makeFarm({ crop: task.crop });
          this.reportResult(task, true, "Farm set up.");
          break;
        }
        case 'harvest': {
          await this.ctx.farmingSystem.harvest();
          this.reportResult(task, true, "Harvested.");
          break;
        }
        case 'deposit': {
          await this.depositItems();
          this.reportResult(task, true, "Deposited.");
          break;
        }
        case 'explore': {
          this.ctx.movementSystem.explore(80);
          this.reportResult(task, true, "Exploring.");
          break;
        }
        case 'findstructure': {
          this.ctx.movementSystem.explore(120);
          this.reportResult(task, true, "Searching for structures.");
          break;
        }
        default:
          bot.chat("I don't know that task.");
      }
    } catch (e) {
      console.log('[KYARA TASK] Error:', e.message);
      this.reportResult(task, false, "Task crashed. Oops.");
    }
    this.currentTask = null;
  }

  reportResult(task, success, msg) {
    // Only send the witty comment, not the boring technical msg, to reduce spam
    this.ctx.memory.recordDecision(`${task.type} task`, success ? 'success' : 'failure');
    this.ctx.chatHandler.handleEvent(success ? 'task_done' : 'task_failed').then(r => { 
      if (r) this.bot.chat(r); 
      else this.bot.chat(msg); // Fallback to msg if AI doesn't respond
    });
  }

  async craftItem(itemName) {
    const bot = this.bot;
    const mcData = require('minecraft-data')(bot.version);
    const normalized = this.normalizeItemName(itemName);
    const item = mcData.itemsByName[normalized];
    if (!item) {
      bot.chat(`Don't know what ${itemName} is.`);
      return false;
    }

    // Look for a nearby crafting table FIRST. Most tools/weapons need the 3x3
    // grid, and bot.recipesFor() only returns those recipes when a table is
    // passed in - calling it without one silently returns only 2x2 recipes
    // (sticks, planks, etc), making every tool/weapon craft fail as "no recipe".
    let table = bot.findBlock({ matching: mcData.itemsByName.crafting_table.id, maxDistance: 4 });
    let recipe = bot.recipesFor(item.id, null, 1, table)[0];

    // No recipe found even with a table nearby (or no table at all) - try
    // placing one from inventory if we're carrying one, then retry.
    if (!recipe && !table) {
      const placed = await this.tryPlaceCraftingTable();
      if (placed) {
        table = bot.findBlock({ matching: mcData.itemsByName.crafting_table.id, maxDistance: 4 });
        recipe = bot.recipesFor(item.id, null, 1, table)[0];
      }
    }

    if (!recipe) {
      bot.chat(table
        ? `Got materials for ${itemName} but the recipe doesn't fit. Might be missing ingredients.`
        : `No crafting table nearby for ${itemName} and I don't have one to place.`);
      return false;
    }

    try {
      await bot.craft(recipe, 1, table);
      return true;
    } catch (e) {
      bot.chat(`Can't craft ${itemName}. Missing materials probably.`);
      return false;
    }
  }

  async tryPlaceCraftingTable() {
    const bot = this.bot;
    const mcData = require('minecraft-data')(bot.version);
    let tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');

    // No table on hand - try crafting one first (fits the 2x2 grid, no table needed)
    if (!tableItem) {
      const tableType = mcData.itemsByName.crafting_table;
      const tableRecipe = bot.recipesFor(tableType.id)[0];
      if (!tableRecipe) return false;
      try {
        await bot.craft(tableRecipe, 1, null);
        tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
      } catch (e) {
        return false;
      }
    }
    if (!tableItem) return false;

    try {
      const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      await bot.equip(tableItem, 'hand');
      await bot.placeBlock(refBlock, new (require('vec3'))(0, 1, 0));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Turn loose player phrasing ("wodden pickaxe", "Wooden Pickaxe") into a
  // valid minecraft-data item id ("wooden_pickaxe").
  normalizeItemName(raw) {
    const TYPO_FIXES = {
      wodden: 'wooden', woden: 'wooden', stick: 'stick',
      pickaxe: 'pickaxe', pickax: 'pickaxe', axe: 'axe',
      sord: 'sword', sward: 'sword'
    };
    let s = raw.toLowerCase().trim().replace(/[^a-z0-9\s_]/g, '');
    s = s.split(/\s+/).map(w => TYPO_FIXES[w] || w).join('_');
    return s.replace(/_+/g, '_');
  }

  async depositItems() {
    const bot = this.bot;
    const base = this.ctx.memory.memory.base;
    if (!base.built) {
      bot.chat("No base yet. Can't deposit.");
      return;
    }
    // Path to base
    try {
      const { goals } = require('mineflayer-pathfinder');
      bot.pathfinder.setGoal(new goals.GoalNear(base.location.x, base.location.y, base.location.z, 2));
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {}

    // Open chest and deposit
    const chest = base.chestLocations[0];
    if (!chest) {
      bot.chat("No chest location recorded.");
      return;
    }
    const chestBlock = bot.blockAt(new (require('vec3'))(chest.x, chest.y, chest.z));
    if (!chestBlock || !chestBlock.name.includes('chest')) {
      bot.chat("Can't find my chest.");
      return;
    }
    try {
      const c = await bot.openChest(chestBlock);
      const items = bot.inventory.items();
      for (const item of items) {
        // Keep essentials
        if (this.isEssential(item)) continue;
        try {
          await c.deposit(item.type, null, item.count);
          this.ctx.inventorySystem.addToStash(item.name, item.count);
        } catch (e) {}
      }
      c.close();
      bot.chat("Deposited. Inventory breathing room achieved.");
    } catch (e) {
      bot.chat("Couldn't open chest.");
    }
  }

  isEssential(item) {
    const essentials = ['sword', 'pickaxe', 'axe', 'shovel', 'torch', 'bread', 'cooked_', 'apple', 'golden_apple'];
    return essentials.some(e => item.name.includes(e));
  }
}

module.exports = TaskSystem;