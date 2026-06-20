const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp');
const collectBlock = require('mineflayer-collectblock');
const mcData = require('minecraft-data');

const memory = require('./kyaraMemory');
const personality = require('./kyaraPersonality');
const KyaraChatHandler = require('./kyaraChatHandler');
const kyaraAI = require('./kyaraAI');

const SurvivalSystem = require('../systems/survivalSystem');
const InventorySystem = require('../systems/inventorySystem');
const MiningSystem = require('../systems/miningSystem');
const BuildSystem = require('../systems/buildSystem');
const CombatSystem = require('../systems/combatSystem');
const FarmingSystem = require('../systems/farmingSystem');
const TaskSystem = require('../systems/taskSystem');
const MovementSystem = require('../systems/movementSystem');
const GoalScheduler = require('../systems/goalScheduler');

const LearningEngine = require('../learning/learningEngine');
const StrategyMemory = require('../learning/strategyMemory');
const PlayerMemory = require('../learning/playerMemory');
const MistakeLog = require('../learning/mistakeLog');
const ExperienceRecorder = require('../learning/experienceRecorder');

function createKyaraBot(settings) {
  console.log(`[KYARA] Connecting to ${settings.host}:${settings.port} as ${settings.username}...`);

  const bot = mineflayer.createBot({
    host: settings.host,
    port: settings.port,
    username: settings.username,
    version: settings.version,
    auth: settings.auth || 'offline',
    viewDistance: settings.viewDistance || 10,
    hideErrors: false
  });

  bot.settings_obj = settings;

    // Load plugins safely (bypassing broken plugin updates)
  bot.loadPlugin(pathfinder);
  
  try {
    if (typeof pvp === 'function') bot.loadPlugin(pvp);
    else if (pvp.bot) bot.loadPlugin(pvp.bot);
  } catch (e) { console.log('[KYARA] PVP plugin load skipped'); }

  try {
    if (typeof collectBlock === 'function') bot.loadPlugin(collectBlock);
    else if (collectBlock.plugin) bot.loadPlugin(collectBlock.plugin);
  } catch (e) { console.log('[KYARA] CollectBlock plugin load skipped'); }

  // Shared context object
  const ctx = { bot, settings, memory, personality, kyaraAI };

  // Instantiate systems
  const chatHandler = new KyaraChatHandler();
  const survivalSystem = new SurvivalSystem(ctx);
  const inventorySystem = new InventorySystem(ctx);
  const miningSystem = new MiningSystem(ctx);
  const buildSystem = new BuildSystem(ctx);
  const combatSystem = new CombatSystem(ctx);
  const farmingSystem = new FarmingSystem(ctx);
  const movementSystem = new MovementSystem(ctx);
  const taskSystem = new TaskSystem(ctx);
  const goalScheduler = new GoalScheduler(ctx);

  // Learning modules
  const learningEngine = new LearningEngine(ctx);
  const strategyMemory = new StrategyMemory(ctx);
  const playerMemory = new PlayerMemory(ctx);
  const mistakeLog = new MistakeLog(ctx);
  const experienceRecorder = new ExperienceRecorder(ctx);

  // Wire everything together
  ctx.chatHandler = chatHandler;
  ctx.survivalSystem = survivalSystem;
  ctx.inventorySystem = inventorySystem;
  ctx.miningSystem = miningSystem;
  ctx.buildSystem = buildSystem;
  ctx.combatSystem = combatSystem;
  ctx.farmingSystem = farmingSystem;
  ctx.movementSystem = movementSystem;
  ctx.taskSystem = taskSystem;
  ctx.goalScheduler = goalScheduler;
  ctx.learning = { learningEngine, strategyMemory, playerMemory, mistakeLog, experienceRecorder };

  // Initialize systems with full ctx (now complete)
  chatHandler.setBot(bot, ctx);
  survivalSystem.init(ctx);
  inventorySystem.init(ctx);
  miningSystem.init(ctx);
  buildSystem.init(ctx);
  combatSystem.init(ctx);
  farmingSystem.init(ctx);
  movementSystem.init(ctx);
  taskSystem.init(ctx);
  goalScheduler.init(ctx);
  learningEngine.init(ctx);
  strategyMemory.init(ctx);
  playerMemory.init(ctx);
  mistakeLog.init(ctx);
  experienceRecorder.init(ctx);

  bot.ctx = ctx;

  // --- Events ---
bot.once('spawn', () => {
  console.log('[KYARA] Spawned. Hello world.');
  const movements = new Movements(bot, mcData(bot.version));
  // Aternos Anti-Cheat fix
  movements.allowSprinting = false;
  movements.allowParkour = false;
  movements.canDig = false; // disable digging during pathfinding to reduce flag risk
  bot.pathfinder.setMovements(movements);
  bot.movements = movements;

  bot.chat("yo. I'm here. Try not to embarrass yourselves.");

  // Wait 15 seconds for physics to fully settle before ANY movement
  setTimeout(() => {
    goalScheduler.start();
    learningEngine.start();
  }, 15000);
});

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    console.log(`[CHAT] ${username}: ${message}`);
    const resp = await chatHandler.handlePlayerChat(username, message);
    if (resp) {
      setTimeout(() => {
        try { bot.chat(resp); } catch (e) {}
      }, settings.chatDelay || 800);
    }
  });

  bot.on('playerJoined', (player) => {
    if (player.username === bot.username) return;
    memory.getPlayer(player.username);
    playerMemory.onPlayerJoin(player.username);
    if (player.username === settings.ownerName) {
      setTimeout(() => bot.chat("Oh you're here. Finally."), 1500);
    } else {
      chatHandler.handleEvent('player_joins', { playerName: player.username }).then(resp => {
        if (resp) setTimeout(() => bot.chat(resp), 2000);
      });
    }
  });

  bot.on('health', () => {
    survivalSystem.onHealthChange(bot.health);
    if (bot.health < 8) {
      chatHandler.handleEvent('low_health').then(resp => {
        if (resp) bot.chat(resp);
      });
    }
  });

  bot.on('death', () => {
    memory.memory.meta.deathCount++;
    mistakeLog.analyzeDeath(bot);
    chatHandler.handleEvent('death').then(resp => {
      if (resp) setTimeout(() => bot.chat(resp), 1500);
    });
  });

  bot.on('respawn', () => {
    console.log('[KYARA] Respawned.');
  });

  bot.on('kicked', (reason) => {
    console.log('[KYARA] Kicked:', reason);
  });

  bot.on('error', (err) => {
    console.log('[KYARA] Error:', err.message);
  });

  bot.on('end', () => {
    console.log('[KYARA] Bot ended.');
    memory.save();
  });

  // Random thoughts
  setInterval(() => {
    if (!bot.entity) return;
    const thought = chatHandler.maybeRandomThought();
    if (thought) {
      try { bot.chat(thought); } catch (e) {}
    }
  }, 180000); // every 3 minutes

  // Periodic memory save
  setInterval(() => memory.save(), 60000);

  // Experience recorder tick
  setInterval(() => experienceRecorder.tick(), 30000);

  return bot;
}

module.exports = { createKyaraBot };
