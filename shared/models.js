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

const MOD_CAR_ASSET_FILES = [
  "ambulance",
  "box",
  "cone-flat",
  "cone",
  "debris-bolt",
  "debris-bumper",
  "debris-door-window",
  "debris-door",
  "debris-drivetrain-axle",
  "debris-drivetrain",
  "debris-nut",
  "debris-plate-a",
  "debris-plate-b",
  "debris-plate-small-a",
  "debris-plate-small-b",
  "debris-spoiler-a",
  "debris-spoiler-b",
  "debris-tire",
  "delivery-flat",
  "delivery",
  "firetruck",
  "garbage-truck",
  "hatchback-sports",
  "kart-oobi",
  "kart-oodi",
  "kart-ooli",
  "kart-oopi",
  "kart-oozi",
  "police",
  "race-future",
  "race",
  "sedan-sports",
  "sedan",
  "suv-luxury",
  "suv",
  "taxi",
  "tractor-police",
  "tractor-shovel",
  "tractor",
  "truck-flat",
  "truck",
  "van",
  "wheel-dark",
  "wheel-default",
  "wheel-racing",
  "wheel-tractor-back",
  "wheel-tractor-dark-back",
  "wheel-tractor-dark-front",
  "wheel-tractor-front",
  "wheel-truck",
];

const MOD_PLANE_ASSET_FILES = [
  "basicPlane",
  "biPlane",
  "spaceShuttle",
  "stuntPlane",
];

const QUATERNIUS_FURNITURE_ASSETS = [
  "BedDouble",
  "BedTwin",
  "Bookcase_Books",
  "Bookcase",
  "Chair",
  "Desk",
  "NightStand",
  "OfficeChair",
  "Sofa",
  "Sofa2",
  "Stool",
  "Table",
];

const QUATERNIUS_WEAPON_ASSETS = [
  "Axe",
  "Axe_Double",
  "Bow_Golden",
  "Bow_Wooden",
  "Claymore",
  "Dagger",
  "Hammer_Small",
  "Scythe",
  "Spear",
  "Sword",
  "Sword_Golden",
  "Shield_Round",
];

const humanizeModAssetName = (slug) => slug
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[-_]+/g, " ")
  .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const MOD_ASSET_CATALOG = [
  ...MOD_CAR_ASSET_FILES.map((slug, index) => ({
    id: `mod_car_${slug.replace(/[^a-z0-9]+/g, "_")}`,
    name: humanizeModAssetName(slug),
    category: "asset",
    categoryLabel: "Imported assets",
    color: index % 2 === 0 ? "#7d9485" : "#b7a777",
    price: 55 + (index % 5) * 10,
    variant: index,
    assetKey: `mod-car-kit/${slug}.glb`,
    source: "Kenney Car Kit",
  })),
  ...MOD_PLANE_ASSET_FILES.map((slug, index) => ({
    id: `mod_plane_${slug.replace(/[^a-z0-9]+/g, "_")}`,
    name: humanizeModAssetName(slug),
    category: "asset",
    categoryLabel: "Imported assets",
    color: index % 2 === 0 ? "#b5c9d8" : "#d4b485",
    price: 70 + (index % 4) * 12,
    variant: index,
    assetKey: `mod-low-poly-plane/${slug}.fbx`,
    source: "Low Poly Plane Pack",
  })),
  ...QUATERNIUS_FURNITURE_ASSETS.map((slug, index) => ({
    id: `quaternius_furniture_${slug.toLowerCase()}`,
    name: humanizeModAssetName(slug),
    category: "furniture",
    categoryLabel: "Furniture",
    color: index % 2 === 0 ? "#a96f48" : "#bd8a62",
    price: 100 + (index % 4) * 15,
    variant: index,
    assetKey: `quaternius-furniture/${slug}.fbx`,
    source: "Quaternius Ultimate Furniture Pack",
  })),
  ...QUATERNIUS_WEAPON_ASSETS.map((slug, index) => ({
    id: `quaternius_weapon_${slug.toLowerCase()}`,
    name: humanizeModAssetName(slug),
    category: "weapon",
    categoryLabel: "Weapons",
    color: index % 2 === 0 ? "#c66c59" : "#927765",
    price: 120 + (index % 4) * 20,
    variant: index,
    assetKey: `quaternius-medieval-weapons/${slug}.fbx`,
    source: "Quaternius Modular Weapons Pack",
  })),
];

export const MODEL_CATALOG = [
  ...BLOCK_BITS_CATALOG,
  ...BLASTER_CATALOG,
  ...MOD_ASSET_CATALOG,
  ...PROCEDURAL_MODEL_CATALOG,
];

export const MODEL_ITEM_BY_ID = new Map(MODEL_CATALOG.map((item) => [item.id, item]));
export const MODEL_ITEMS = MODEL_CATALOG.map((item) => item.id);
export const MODEL_CATEGORIES_LIST = [
  { id: "imported", label: "Imported assets" },
  ...MODEL_CATEGORIES.map(({ id, label }) => ({ id, label })),
  { id: "asset", label: "Block Bits" },
];
