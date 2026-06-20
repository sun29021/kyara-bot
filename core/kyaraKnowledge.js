// Pre-loaded Minecraft knowledge — recipes, progression, structures

const TOOL_TIERS = {
  wood:      { materials: 'planks',       count: 2 },
  stone:     { materials: 'cobblestone',  count: 2 },
  iron:      { materials: 'iron_ingot',   count: 2 },
  gold:      { materials: 'gold_ingot',   count: 2 },
  diamond:   { materials: 'diamond',      count: 2 },
  netherite: { base: 'diamond_tool', upgrade: 'netherite_ingot', table: 'smithing_table' }
};

const TOOL_TYPES = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'];
const ARMOR_TYPES = ['helmet', 'chestplate', 'leggings', 'boots'];

const RECIPES = {
  crafting_table: { result: 'crafting_table', count: 1, ingredients: { planks: 4 } },
  furnace: { result: 'furnace', count: 1, ingredients: { cobblestone: 8 } },
  chest: { result: 'chest', count: 1, ingredients: { planks: 8 } },
  stick: { result: 'stick', count: 4, ingredients: { planks: 2 } },
  torch: { result: 'torch', count: 4, ingredients: { coal: 1, stick: 1 } },
  bread: { result: 'bread', count: 1, ingredients: { wheat: 3 } },
  bed: { result: 'bed', count: 1, ingredients: { wool: 3, planks: 3 } },
  bow: { result: 'bow', count: 1, ingredients: { stick: 3, string: 3 } },
  arrow: { result: 'arrow', count: 4, ingredients: { flint: 1, stick: 1, feather: 1 } },
  shield: { result: 'shield', count: 1, ingredients: { planks: 6, iron_ingot: 1 } },
  anvil: { result: 'anvil', count: 1, ingredients: { iron_block: 3, iron_ingot: 4 } },
  enchanting_table: { result: 'enchanting_table', count: 1, ingredients: { obsidian: 4, diamond: 2, book: 1 } },
  bookshelf: { result: 'bookshelf', count: 1, ingredients: { planks: 6, book: 3 } },
  hopper: { result: 'hopper', count: 1, ingredients: { iron_ingot: 5, chest: 1 } },
  piston: { result: 'piston', count: 1, ingredients: { planks: 3, cobblestone: 4, iron_ingot: 1, redstone: 1 } }
};

const PROGRESSION = [
  { phase: 1, days: '1-2', goals: ['Wood', 'Stone tools', 'Shelter', 'Coal', 'Food source'] },
  { phase: 2, days: '3-7', goals: ['Iron tools + armor', 'Deep mining', 'Bread farm'] },
  { phase: 3, days: '7-14', goals: ['Diamonds', 'Enchanting setup', 'Nether portal'] },
  { phase: 4, days: 'Nether', goals: ['Blaze rods', 'Nether wart', 'Wither skulls', 'Bastion', 'Netherite'] },
  { phase: 5, days: 'Mid', goals: ['Potion brewing', 'Elytra prep', 'Find stronghold'] },
  { phase: 6, days: 'End', goals: ['Destroy End Crystals', 'Kill Ender Dragon', 'End Cities', 'Elytra'] },
  { phase: 7, days: 'Late', goals: ['Beacon', 'Wither farm', 'Iron farm', 'Shulker farm', 'Full automation'] }
];

const STRUCTURES = {
  village: { value: 'free food + beds + iron golem', danger: 'low' },
  desert_temple: { value: '4 chests + TNT trap (cut wire first!)', danger: 'medium' },
  woodland_mansion: { value: 'Evoker (totem) + Vindicator', danger: 'high' },
  ocean_monument: { value: 'Mining Fatigue (drink milk), sponge room, gold blocks', danger: 'high' },
  stronghold: { value: 'End Portal (12 Eyes of Ender needed)', danger: 'medium' },
  nether_fortress: { value: 'Blazes + Wither Skeletons + Nether Wart', danger: 'high' },
  bastion: { value: 'Gold loot + Netherite chance (piglin barter)', danger: 'high' },
  end_city: { value: 'Elytra + best loot in game', danger: 'high' }
};

const BOSS_STRATEGIES = {
  ender_dragon: {
    steps: ['Shoot all End Crystals first', 'Attack when perching', 'Immune while flying'],
    weakness: 'beds (explosion damage)',
    reward: 'Elytra access, dragon egg'
  },
  wither: {
    steps: ['Spawn underground', 'Phase 1: use bow', 'Phase 2 (½ HP): use sword (arrow immune)', 'Weakness potion helps'],
    weakness: 'smite enchantment',
    reward: 'Nether star (beacon)'
  },
  elder_guardian: {
    steps: ['Drink milk to cure Mining Fatigue', 'Kill all 3 in monument'],
    weakness: 'bow from outside',
    reward: 'sponge, gold blocks'
  }
};

const ORE_LEVELS = {
  diamond: { best: -59, range: [-64, -16] },
  iron: { best: 15, range: [-64, 72] },
  gold: { best: -16, range: [-64, 32] },
  coal: { best: 95, range: [0, 128] },
  redstone: { best: -59, range: [-64, 15] },
  lapis: { best: -1, range: [-64, 64] },
  emerald: { best: 95, range: [-64, 320] },
  copper: { best: 47, range: [-16, 112] }
};

module.exports = {
  TOOL_TIERS, TOOL_TYPES, ARMOR_TYPES, RECIPES, PROGRESSION,
  STRUCTURES, BOSS_STRATEGIES, ORE_LEVELS
};