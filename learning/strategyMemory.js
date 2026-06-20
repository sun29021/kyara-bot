class StrategyMemory {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = false; }
  init(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.initialized = true; }

  updateMiningStrategy(yLevel, oreFound, success) {
    const s = this.ctx.memory.strategy.mining;
    if (success) {
      s.successfulRuns++;
      if (oreFound && oreFound.name) {
        if (!s.bestOreFound[oreFound.name] || oreFound.count > s.bestOreFound[oreFound.name].count) {
          s.bestOreFound[oreFound.name] = { count: oreFound.count, yLevel, timestamp: Date.now() };
        }
      }
    } else {
      s.miningDeaths++;
      if (!s.avoidYLevel.includes(yLevel)) {
        // Only avoid after 2 deaths
        if (s.miningDeaths > 2) s.avoidYLevel.push(yLevel);
      }
    }
  }

  updateCombatStrategy(mobType, success) {
    const s = this.ctx.memory.strategy.combat;
    if (success) {
      if (mobType === 'player') s.pvpWins++;
    } else {
      if (mobType === 'player') s.pvpLosses++;
      if (!s.deathCauses.includes(mobType)) s.deathCauses.push(mobType);
    }
  }

  updateBuildStrategy(material, success) {
    const s = this.ctx.memory.strategy.building;
    if (success) {
      if (!s.completedBuilds.find(b => b.material === material)) {
        s.preferredMaterial = material; // upgrade
      }
    } else {
      s.failedBuilds.push({ material, timestamp: Date.now() });
    }
  }

  getMiningRecommendation() {
    const s = this.ctx.memory.strategy.mining;
    return {
      yLevel: s.preferredYLevel,
      tactic: s.currentTactic,
      avoidYLevels: s.avoidYLevel
    };
  }

  getCombatRecommendation(mobType) {
    const s = this.ctx.memory.strategy.combat;
    return {
      tactic: s.preferredTactic,
      aggressiveness: s.aggressiveness,
      retreatThreshold: s.retreatThreshold,
      isDangerous: s.knownDangerousMobs.includes(mobType.toLowerCase())
    };
  }
}

module.exports = StrategyMemory;