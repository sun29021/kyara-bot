class SurvivalSystem {
  constructor(ctx) { this.ctx = ctx; this.bot = ctx.bot; this.lastHealth = 20; this.mlgReady = true; }
  init(ctx) { 
    this.ctx = ctx; this.bot = ctx.bot; 
    this.initMlgReflex();
  }

  initMlgReflex() {
    this.bot.on('physicsTick', async () => {
      if (!this.bot.entity) return;
      if (this.bot.entity.onGround || this.bot.entity.isInWater) return;
      
      if (this.bot.entity.velocity.y < -0.8 && this.mlgReady) {
        const waterBucket = this.bot.inventory.items().find(i => i.name === 'water_bucket');
        if (!waterBucket) return;

        const pos = this.bot.entity.position;
        const blockBelow = this.bot.blockAt(pos.offset(0, -3, 0));
        
        if (blockBelow && blockBelow.name !== 'air' && blockBelow.boundingBox === 'block') {
          try {
            this.mlgReady = false;
            const currentPitch = this.bot.entity.pitch;
            
            await this.bot.equip(waterBucket, 'hand');
            await this.bot.look(0, -Math.PI / 2, true);
            this.bot.activateItem();
            
            setTimeout(async () => {
              try {
                this.bot.activateItem();
                await this.bot.look(0, currentPitch, true);
              } catch (e) {}
              this.mlgReady = true;
            }, 400);
            
          } catch (e) {
            this.mlgReady = true;
          }
        }
      }
    });
  }

  onHealthChange(health) {
    if (health < 4 && this.lastHealth >= 4) {
      this.ctx.memory.memory.survival.nearDeathCount++;
      this.ctx.memory.memory.survival.confidenceLevel = Math.max(0, this.ctx.memory.memory.survival.confidenceLevel - 5);
      this.flee();
    }
    this.lastHealth = health;
  }

  isHungry() { return this.bot.food < 15; }
  isNight() { return this.bot.time.timeOfDay > 12500 && this.bot.time.timeOfDay < 23500; }

  eatNow() {
    const food = this.findBestFood();
    if (!food) return false;
    try {
      this.bot.equip(food, 'hand', () => {
        this.bot.activateItem();
        this.ctx.memory.memory.survival.lastFoodEaten = food.name;
      });
      return true;
    } catch (e) { return false; }
  }

  findBestFood() {
    const foods = ['cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'bread', 'apple', 'golden_apple', 'beef', 'porkchop', 'carrot'];
    for (const f of foods) {
      const item = this.bot.inventory.items().find(i => i.name === f);
      if (item) return item;
    }
    return this.bot.inventory.items().find(i => i && i.food);
  }

  async huntFood() {
    // Use displayName instead of mobType to fix warning
    const animals = Object.values(this.bot.entities).filter(e =>
      e.displayName && ['Cow', 'Pig', 'Chicken', 'Sheep', 'Rabbit'].includes(e.displayName) &&
      this.bot.entity.position.distanceTo(e.position) < 20
    );
    if (animals.length === 0) return false;
    try { this.bot.pvp.attack(animals[0]); setTimeout(() => this.eatNow(), 3000); } catch (e) {}
    return true;
  }

  sleepNow() {
    if (!this.isNight()) return this.bot.chat("It's daytime.");
    const bed = this.bot.inventory.items().find(i => i.name.includes('bed'));
    if (bed) {
      this.bot.chat("Trying to sleep.");
    } else {
      this.bot.chat("No bed. Pulling an all-nighter.");
    }
  }

  flee() {
    // Use displayName instead of mobType to fix warning
    const hostiles = Object.values(this.bot.entities).filter(e =>
      e.displayName && this.bot.entity.position.distanceTo(e.position) < 10 &&
      ['Zombie', 'Skeleton', 'Creeper', 'Spider', 'Enderman', 'Witch', 'Blaze', 'Pillager', 'Vindicator', 'Evoker', 'Ravager'].includes(e.displayName)
    );
    if (hostiles.length === 0) return;
    const away = this.bot.entity.position.minus(hostiles[0].position).normalize().scale(10);
    const target = this.bot.entity.position.plus(away);
    try { this.bot.pathfinder.setGoal(new (require('mineflayer-pathfinder').goals.GoalXZ)(target.x, target.z)); } catch (e) {}
  }
}

module.exports = SurvivalSystem;