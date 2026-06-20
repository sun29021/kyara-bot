class ExperienceRecorder {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; this.events = []; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; this.events = []; }

  recordEvent(event) {
    this.events.push({ ...event, timestamp: event.timestamp || Date.now() });
    if (this.events.length > 200) this.events = this.events.slice(-200);
  }

  tick() {
    // Periodic snapshot
    if (!this.bot.entity) return;
    this.recordEvent({
      type: 'snapshot',
      health: this.bot.health,
      food: this.bot.food,
      position: { x: this.bot.entity.position.x, y: this.bot.entity.position.y, z: this.bot.entity.position.z },
      inventoryCount: this.bot.inventory.items().length
    });
  }

  getStats() {
    const stats = { total: this.events.length, byType: {} };
    for (const e of this.events) {
      stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
    }
    return stats;
  }

  getRecentEvents(count = 10) {
    return this.events.slice(-count);
  }
}

module.exports = ExperienceRecorder;