const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ, GoalFollow, GoalY } = goals;
const Vec3 = require('vec3');

class MovementSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.following = null; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  comeToPlayer(playerName) {
    const bot = this.bot;
    const player = bot.players[playerName];
    if (!player || !player.entity) {
      bot.chat("Can't see you. Where are you?");
      return;
    }
    const target = player.entity.position;
    bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 2));
  }

  followPlayer(playerName) {
    const bot = this.bot;
    this.following = playerName;
    const followLoop = () => {
      if (this.following !== playerName) return;
      const player = bot.players[playerName];
      if (player && player.entity) {
        const target = player.entity.position;
        bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
      }
      setTimeout(followLoop, 3000);
    };
    followLoop();
  }

  stop() {
    this.following = null;
    try { this.bot.pathfinder.setGoal(null); } catch (e) {}
    try { this.bot.pvp.stop(); } catch (e) {}
  }

  goto(x, y, z) {
    const bot = this.bot;
    bot.pathfinder.setGoal(new GoalBlock(x, y, z));
  }

  gotoXZ(x, z) {
    this.bot.pathfinder.setGoal(new GoalXZ(x, z));
  }

  goToY(y) {
    this.bot.pathfinder.setGoal(new GoalY(y));
  }

  explore(radius = 15) {
    const pos = this.bot.entity.position;
    // Cap radius to 15 max to avoid anti-cheat kicks on Aternos
    const safeRadius = Math.min(radius, 15);
    const tx = pos.x + Math.floor((Math.random() - 0.5) * safeRadius * 2);
    const tz = pos.z + Math.floor((Math.random() - 0.5) * safeRadius * 2);
    // Silent explore - no chat message
    this.bot.pathfinder.setGoal(new (require('mineflayer-pathfinder').goals.GoalXZ)(tx, tz));
  }

  distanceTo(pos) {
    return this.bot.entity.position.distanceTo(new Vec3(pos.x, pos.y, pos.z));
  }
}

module.exports = MovementSystem;