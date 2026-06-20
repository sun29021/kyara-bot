class LearningEngine {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; this.reviewInterval = null; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  start() {
    // Review every 30 minutes
    this.reviewInterval = setInterval(() => this.review(), 30 * 60 * 1000);
    console.log('[KYARA] Learning engine started.');
  }

  stop() {
    if (this.reviewInterval) clearInterval(this.reviewInterval);
  }

  review() {
    const decisions = this.ctx.memory.strategy.decisions.log.slice(-10);
    if (decisions.length === 0) return;

    const successes = decisions.filter(d => d.outcome === 'success').length;
    const failures = decisions.filter(d => d.outcome === 'failure').length;

    // Update strategy notes
    if (failures > successes) {
      this.ctx.memory.addImprovementNote(`High failure rate (${failures}/${decisions.length}). Need to revise tactics.`);
      this.ctx.memory.memory.survival.confidenceLevel = Math.max(0, this.ctx.memory.memory.survival.confidenceLevel - 3);
    } else if (successes > failures) {
      this.ctx.memory.memory.survival.confidenceLevel = Math.min(100, this.ctx.memory.memory.survival.confidenceLevel + 3);
    }

    // Mining strategy
    const miningSuccess = this.ctx.memory.strategy.mining.successfulRuns;
    if (miningSuccess >= 5) {
      this.ctx.memory.strategy.mining.preferredYLevel = -59; // lock it
    }

    // Combat strategy
    const pvpWins = this.ctx.memory.strategy.combat.pvpWins;
    if (pvpWins >= 3) {
      this.ctx.memory.strategy.combat.aggressiveness = Math.min(10, this.ctx.memory.strategy.combat.aggressiveness + 1);
    }
    const pvpLosses = this.ctx.memory.strategy.combat.pvpLosses;
    if (pvpLosses >= 2) {
      this.ctx.memory.strategy.combat.retreatThreshold = Math.min(10, this.ctx.memory.strategy.combat.retreatThreshold + 1);
    }

    console.log(`[KYARA LEARNING] Review: ${successes} successes, ${failures} failures. Confidence: ${this.ctx.memory.memory.survival.confidenceLevel}`);
  }

  onEvent(eventType, data) {
    this.ctx.learning.experienceRecorder.recordEvent({ type: eventType, ...data, timestamp: Date.now() });
  }
}

module.exports = LearningEngine;