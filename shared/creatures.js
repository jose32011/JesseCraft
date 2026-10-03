const SPECIES_COUNT_PER_HABITAT = 256;

const colorVariants = [
  "#a95f42", "#d69b4c", "#8a6d57", "#eee1c2",
  "#777c82", "#514b48", "#bd7864", "#c5b99a",
  "#916d9c", "#5c7893", "#759566", "#b9a26e",
  "#d7e5e8", "#454d43", "#e1b6b2", "#87aab0",
];

const nameStarts = [
  "Amber", "Ashen", "Auburn", "Azure", "Birch", "Brass", "Cedar", "Cloud",
  "Coral", "Dawn", "Dusk", "Ember", "Fern", "Frost", "Gold", "Pearl",
];

export const CREATURE_HABITATS = [
  {
    id: "village",
    name: "Village",
    models: ["cow", "alpaca"],
    speciesNames: ["Cattle", "Longneck", "Meadow", "Softstep", "Mossback", "Clover", "Hillgraze", "Wooltail", "Tawny", "Hearth", "Velvet", "Dapple", "Milkbud", "Hayrunner", "Oakgraze", "Brindle"],
    spawnPoints: [[-13, -8], [-7, -12], [9, -11], [15, -7]],
    aquatic: false,
  },
  {
    id: "coast",
    name: "Coast",
    models: ["fox", "alpaca", "cow"],
    speciesNames: ["Sandfox", "Dunestep", "Shore", "Saltpelt", "Tidefox", "Driftback", "Suncrawl", "Beachrun", "Shellstep", "Goldtail", "Seagrass", "Sandskip", "Pebble", "Warmfur", "Coaststep", "Tidewalk"],
    spawnPoints: [[-10, 120], [-4, 129], [4, 121], [10, 130]],
    aquatic: false,
  },
  {
    id: "ocean",
    name: "Ocean",
    models: ["fish"],
    speciesNames: ["Reefglide", "Bluefin", "Glassfin", "Coraldart", "Moonfish", "Tideswim", "Silverfin", "Kelpfin", "Sunscale", "Pearlrun", "Waveskim", "Deepglow", "Starfin", "Seaspark", "Current", "Brightfin"],
    spawnPoints: [[-29, 157], [-22, 166], [-14, 153], [-7, 164]],
    aquatic: true,
  },
  {
    id: "forest",
    name: "Forest",
    models: ["fox", "wolf", "alpaca"],
    speciesNames: ["Fox", "Wolf", "Pinepelt", "Mossrun", "Leafstalk", "Fernpaw", "Cedarstep", "Bramble", "Shadow", "Dewrun", "Thicket", "Branchstep", "Moonstalk", "Needlefoot", "Grove", "Wildwood"],
    spawnPoints: [[-11, 204], [-4, 214], [5, 205], [12, 215]],
    aquatic: false,
  },
  {
    id: "highlands",
    name: "Highlands",
    models: ["wolf", "alpaca", "cow"],
    speciesNames: ["Frostwolf", "Snowstep", "Cloudgraze", "Ridgepelt", "Stonehorn", "Peakrun", "Iceback", "Highstep", "Stormpelt", "Cragstep", "Windgraze", "Glacier", "Skyhorn", "Mistrun", "Frostgraze", "Summit"],
    spawnPoints: [[30, 278], [38, 291], [47, 276], [55, 289]],
    aquatic: false,
  },
].map((habitat) => ({
  ...habitat,
  species: Array.from({ length: SPECIES_COUNT_PER_HABITAT }, (_, index) => {
    const form = habitat.speciesNames[index % habitat.speciesNames.length];
    const variant = Math.floor(index / habitat.speciesNames.length);
    const color = colorVariants[variant % colorVariants.length];
    const model = habitat.models[(variant + index) % habitat.models.length];
    return {
      id: `${habitat.id}-${index.toString().padStart(3, "0")}`,
      name: `${nameStarts[Math.floor(index / 16)]} ${form}`,
      habitat: habitat.id,
      model,
      color,
      aquatic: habitat.aquatic,
      scale: 0.82 + (index % 7) * 0.06,
      pattern: index % 4,
    };
  }),
}));

export function getCreatureHabitat(id) {
  return CREATURE_HABITATS.find((habitat) => habitat.id === id) ?? null;
}

export function getCreatureSpecies(habitatId, index) {
  const habitat = getCreatureHabitat(habitatId);
  if (!habitat || !Number.isInteger(index) || index < 0 || index >= habitat.species.length) return null;
  return habitat.species[index];
}
