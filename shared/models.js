const MODEL_CATEGORIES = [
  { id: "furniture", label: "Furniture", color: "#a96f48", basePrice: 35, forms: ["Chair", "Dining Table", "Bookshelf", "Bed", "Chest"], themes: ["Oak", "Pine", "Carved", "Cozy", "Royal", "Rustic", "Moonlit", "Woven", "Gilded", "Cottage", "Bamboo", "Marble", "Frosted", "Ember", "Sage", "Seaside", "Mossy", "Starry", "Willow", "Cloud"] },
  { id: "plant", label: "Plants", color: "#63aa68", basePrice: 18, forms: ["Fern", "Potted Tree", "Flower", "Cactus", "Mushroom"], themes: ["Forest", "Desert", "Silver", "Golden", "Tiny", "Giant", "Jade", "Blooming", "Twilight", "Autumn", "Crystal", "Spotted", "Frost", "Sunset", "Velvet", "Wild", "Lunar", "Coral", "Ancient", "Dewy"] },
  { id: "animal", label: "Animals", color: "#d4a55e", basePrice: 65, forms: ["Fox", "Owl", "Rabbit", "Turtle", "Deer"], themes: ["Woodland", "Snow", "Meadow", "Dappled", "Swift", "Gentle", "Tiny", "Great", "Spotted", "Striped", "Golden", "Dusky", "River", "Highland", "Clover", "Copper", "Misty", "Royal", "Starry", "Sandy"] },
  { id: "monster", label: "Monsters", color: "#8e70be", basePrice: 90, forms: ["Slime", "Golem", "Mimic", "Imp", "Wisp"], themes: ["Moss", "Cave", "Frost", "Ember", "Crystal", "Shadow", "Mushroom", "Thunder", "Bog", "Ash", "Void", "Coral", "Ancient", "Tiny", "Armored", "Wild", "Lunar", "Cursed", "Jade", "Storm"] },
  { id: "dragon", label: "Dragons", color: "#d65344", basePrice: 150, forms: ["Whelp", "Drake", "Wyvern", "Serpent", "Dragon"], themes: ["Ember", "Frost", "Storm", "Forest", "Ocean", "Crystal", "Shadow", "Golden", "Moss", "Cloud", "Lunar", "Ancient", "Ruby", "Sapphire", "Jade", "Copper", "Royal", "Tiny", "Dusk", "Dawn"] },
  { id: "armor", label: "Armor", color: "#758ea0", basePrice: 55, forms: ["Helmet", "Chestplate", "Shield", "Greaves", "Gauntlets"], themes: ["Iron", "Oak", "Copper", "Silver", "Golden", "Crystal", "Moss", "Royal", "Frost", "Ember", "Shadow", "Jade", "Runic", "Traveler", "Knight", "Dragon", "Moon", "Star", "Reinforced", "Light"] },
  { id: "weapon", label: "Weapons", color: "#c66c59", basePrice: 70, forms: ["Sword", "Axe", "Spear", "Bow", "Hammer"], themes: ["Iron", "Oak", "Copper", "Silver", "Golden", "Crystal", "Moss", "Royal", "Frost", "Ember", "Shadow", "Jade", "Runic", "Traveler", "Knight", "Dragon", "Moon", "Star", "Reinforced", "Light"] },
  { id: "tool", label: "Tools", color: "#708b72", basePrice: 45, forms: ["Pickaxe", "Shovel", "Hoe", "Lantern", "Fishing Rod"], themes: ["Iron", "Oak", "Copper", "Silver", "Golden", "Crystal", "Moss", "Royal", "Frost", "Ember", "Shadow", "Jade", "Runic", "Traveler", "Knight", "Dragon", "Moon", "Star", "Reinforced", "Light"] },
  { id: "crystal", label: "Crystals", color: "#63c9cc", basePrice: 40, forms: ["Geode", "Crystal Cluster", "Prism", "Obelisk", "Orb"], themes: ["Azure", "Rose", "Violet", "Emerald", "Amber", "Frost", "Ember", "Shadow", "Lunar", "Solar", "Ocean", "Forest", "Ancient", "Tiny", "Giant", "Singing", "Glowing", "Runic", "Starry", "Wild"] },
  { id: "statue", label: "Decor", color: "#b6a987", basePrice: 60, forms: ["Garden Gnome", "Birdbath", "Fountain", "Lantern", "Totem"], themes: ["Stone", "Oak", "Copper", "Silver", "Golden", "Crystal", "Moss", "Royal", "Frost", "Ember", "Shadow", "Jade", "Runic", "Traveler", "Knight", "Dragon", "Moon", "Star", "Reinforced", "Light"] },
];

const PROCEDURAL_MODEL_CATALOG = MODEL_CATEGORIES.flatMap((category) =>
  Array.from({ length: 100 }, (_, index) => {
    const form = category.forms[Math.floor(index / 20)];
    const theme = category.themes[index % category.themes.length];
    const number = String(index + 1).padStart(3, "0");
    return {
      id: `model_${category.id}_${number}`,
      name: `${theme} ${form} ${number}`,
      category: category.id,
      categoryLabel: category.label,
      color: category.color,
      price: category.basePrice + (index % 5) * 5,
      variant: index,
    };
  }),
);

const BLOCK_BITS_MODEL_NAMES = [
  "bricks_A",
  "bricks_B",
  "colored_block_blue",
  "colored_block_green",
  "colored_block_red",
  "colored_block_yellow",
  "decorative_block_blue",
  "decorative_block_green",
  "decorative_block_red",
  "decorative_block_yellow",
  "dirt",
  "dirt_with_grass",
  "dirt_with_snow",
  "glass",
  "grass",
  "grass_with_snow",
  "gravel",
  "gravel_with_grass",
  "gravel_with_snow",
  "lava",
  "metal",
  "prototype",
  "sand_A",
  "sand_B",
  "sand_with_grass",
  "sand_with_snow",
  "snow",
  "stone_dark",
  "stone",
  "stone_with_copper",
  "stone_with_gold",
  "stone_with_silver",
  "striped_block_blue",
  "striped_block_green",
  "striped_block_red",
  "striped_block_yellow",
  "tree",
  "tree_with_snow",
  "water",
  "wood",
];

const BLOCK_BITS_CATALOG = BLOCK_BITS_MODEL_NAMES.map((assetKey, index) => ({
  id: `asset_${assetKey.toLowerCase()}`,
  name: assetKey.replaceAll("_", " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
  category: "asset",
  categoryLabel: "Block Bits",
  color: index % 2 === 0 ? "#84958d" : "#769466",
  price: 20 + (index % 4) * 5,
  variant: index,
  assetKey: `block-bits/${assetKey}`,
  source: "Block Bits",
}));

const BLASTER_CATALOG = ["a", "b", "c"].map((variant, index) => ({
  id: `kenney_blaster_${variant}`,
  name: `Kenney Blaster ${variant.toUpperCase()}`,
  category: "weapon",
  categoryLabel: "Weapons",
  color: ["#6397be", "#d47850", "#83a567"][index],
  price: 100 + index * 25,
  variant: index,
  assetKey: `kenney-blaster-kit/blaster-${variant}.glb`,
  source: "Kenney Blaster Kit",
}));

export const MODEL_CATALOG = [
  ...BLOCK_BITS_CATALOG,
  ...BLASTER_CATALOG,
  ...PROCEDURAL_MODEL_CATALOG,
];

export const MODEL_ITEM_BY_ID = new Map(MODEL_CATALOG.map((item) => [item.id, item]));
export const MODEL_ITEMS = MODEL_CATALOG.map((item) => item.id);
export const MODEL_CATEGORIES_LIST = [
  { id: "imported", label: "Imported assets" },
  ...MODEL_CATEGORIES.map(({ id, label }) => ({ id, label })),
  { id: "asset", label: "Block Bits" },
];
