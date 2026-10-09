const axios = require('axios');

const API_BASE_URL = 'https://db.ygoprodeck.com/api/v7';

const DECK_PRESETS = {
  'Blue-Eyes': {
    label: 'Blue-Eyes Dragons',
    fusionCards: ['Blue-Eyes Twin Burst Dragon', 'Blue-Eyes Alternative Ultimate Dragon'],
    materialCards: [{ name: 'Blue-Eyes White Dragon', count: 2 }]
  },
  Toon: {
    label: 'Toons',
    fusionCards: [],
    materialCards: []
  },
  'Dark Magician': {
    label: 'Dark Magician',
    fusionCards: ['Dark Cavalry', 'Amulet Dragon'],
    materialCards: [{ name: 'Dark Magician', count: 1 }]
  },
  'Cyber Dragon': {
    label: 'Cyber Dragon',
    fusionCards: ['Cyber Twin Dragon'],
    materialCards: [{ name: 'Cyber Dragon', count: 2 }]
  },
  'Elemental HERO': {
    label: 'Elemental HERO',
    fusionCards: ['Elemental HERO Flame Wingman', 'Elemental HERO Absolute Zero'],
    materialCards: [
      { name: 'Elemental HERO Avian', count: 1 },
      { name: 'Elemental HERO Burstinatrix', count: 1 }
    ]
  },
  'Red-Eyes': {
    label: 'Red-Eyes',
    fusionCards: ['Meteor Black Dragon'],
    materialCards: [
      { name: 'Red-Eyes Black Dragon', count: 1 },
      { name: 'Meteor Dragon', count: 1 }
    ]
  },
  Dragonmaid: {
    label: 'Dragonmaid',
    fusionCards: ['Dragonmaid Sheou', 'House Dragonmaid'],
    materialCards: []
  }
};

const GENERIC_FUSION_CARDS = ['Mudragon of the Swamp', 'Starving Venom Fusion Dragon'];
const SUPPORTED_SPELLS = ['Dark Hole', 'Monster Reborn', 'Mystical Space Typhoon', 'Polymerization'];
const SUPPORTED_TRAPS = ['Mirror Force', 'Trap Hole'];
const MAIN_DECK_COMPOSITION = {
  monster: 26,
  spell: 8,
  trap: 6
};

class CardApiService {
  constructor() {
    this.cardCache = null;
    this.cacheExpiry = null;
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  }

  async getAllCards() {
    // Check if cache is valid
    if (this.cardCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cardCache;
    }

    try {
      console.log('Fetching cards from YGOPRODeck API...');
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, { timeout: 10000 });
      
      if (response.data && response.data.data) {
        this.cardCache = response.data.data;
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
        console.log(`Cached ${this.cardCache.length} cards`);
        return this.cardCache;
      }
      
      throw new Error('Card data is unavailable. Check the server connection and try again.');
    } catch (error) {
      console.error('Error fetching cards from API:', error.message);
      throw new Error('Unable to load card data. Check the server connection and try again.', { cause: error });
    }
  }

  async getRandomCard() {
    try {
      const response = await axios.get(`${API_BASE_URL}/randomcard.php`);
      return response.data;
    } catch (error) {
      console.error('Error fetching random card:', error.message);
      return null;
    }
  }

  async getCardByName(name) {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: { name }
      });
      return response.data.data ? response.data.data[0] : null;
    } catch (error) {
      console.error(`Error fetching card ${name}:`, error.message);
      return null;
    }
  }

  async getCardById(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: { id }
      });
      return response.data.data ? response.data.data[0] : null;
    } catch (error) {
      console.error(`Error fetching card ID ${id}:`, error.message);
      return null;
    }
  }

  async searchCards(params) {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error searching cards:', error.message);
      return [];
    }
  }

  async getCardsByType(type) {
    return this.searchCards({ type });
  }

  async getCardsByAttribute(attribute) {
    return this.searchCards({ attribute });
  }

  async getCardsByLevel(level) {
    return this.searchCards({ level });
  }

  async getCardsByArchetype(archetype) {
    return this.searchCards({ archetype });
  }

  async generateThemedDeck(archetype) {
    const preset = DECK_PRESETS[archetype];
    if (!preset) throw new Error('Unknown deck archetype.');

    const allCards = await this.getAllCards();
    if (allCards.length === 0) {
      throw new Error('Card data is unavailable. Check the server connection and try again.');
    }

    const archetypeCards = allCards.filter(card => card.archetype === archetype);
    if (archetypeCards.length === 0) {
      throw new Error(`No cards were found for the ${preset.label} deck.`);
    }

    const isNormalSummonable = (card) => {
      const cardType = card.type || '';
      const description = card.desc || '';
      return cardType.includes('Monster') &&
        !/(Fusion|Synchro|Xyz|XYZ|Link|Ritual|Pendulum|Token)/i.test(cardType) &&
        !/(cannot be normal summoned|cannot be normal set|must be special summoned)/i.test(description) &&
        Number.isFinite(card.level);
    };
    const mainDeck = [];
    const shuffle = (cards) => {
      const shuffled = [...cards];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    const addCard = (apiCard, count = 1) => {
      if (!apiCard) return;
      const cardName = apiCard.name.toLocaleLowerCase();
      const copies = mainDeck.filter(card =>
        card.name.toLocaleLowerCase() === cardName
      ).length;
      const allowed = Math.min(count, getCardCopyLimit(apiCard) - copies, 40 - mainDeck.length);
      for (let i = 0; i < allowed; i++) {
        mainDeck.push({
          ...this.convertApiCardToGameCard(apiCard),
          deckId: mainDeck.length
        });
      }
    };
    const cardByName = (name) =>
      allCards.find(card => card.name.toLowerCase() === name.toLowerCase());
    const getCardCopyLimit = (card) => {
      const banlist = card.banlist_info?.ban_tcg;
      return banlist === 'Forbidden' ? 0
        : banlist === 'Limited' ? 1
          : banlist === 'Semi-Limited' ? 2 : 3;
    };
    const fill = (pool, targetSize, type) => {
      const candidates = shuffle(pool);
      while (mainDeck.filter(card => card.type === type).length < targetSize) {
        const next = candidates.find(card => {
          const copies = mainDeck.filter(deckCard =>
            deckCard.name.toLocaleLowerCase() === card.name.toLocaleLowerCase()
          ).length;
          return copies < getCardCopyLimit(card);
        });
        if (!next) break;
        addCard(next);
      }
    };
    const addGenericMaterials = () => {
      const monsters = allCards.filter(isNormalSummonable);
      const darkMonsters = monsters.filter(card => card.attribute === 'DARK');
      darkMonsters.slice(0, 2).forEach(card => addCard(card));

      const fusionPair = monsters.find(first =>
        first.attribute && first.race && monsters.some(second =>
          second.id !== first.id &&
          second.attribute === first.attribute &&
          second.race &&
          second.race !== first.race
        )
      );
      if (fusionPair) {
        const partner = monsters.find(card =>
          card.id !== fusionPair.id &&
          card.attribute === fusionPair.attribute &&
          card.race &&
          card.race !== fusionPair.race
        );
        addCard(fusionPair);
        addCard(partner);
      }
    };

    const monsterPool = archetypeCards.filter(isNormalSummonable);
    addGenericMaterials();
    preset.materialCards.forEach(material =>
      addCard(cardByName(material.name), material.count)
    );
    const extraMaterialRequirements = {
      'Dark Magician': [
        card => card.race === 'Warrior',
        card => card.race === 'Dragon'
      ],
      'Elemental HERO': [
        card => card.attribute === 'WATER' && !String(card.archetype || '').includes('HERO')
      ],
      Dragonmaid: [
        card => card.race === 'Dragon' && card.level >= 5 &&
          !String(card.archetype || '').includes('Dragonmaid')
      ]
    };
    (extraMaterialRequirements[archetype] || []).forEach(matches => {
      const material = allCards.find(card =>
        isNormalSummonable(card) && matches(card) &&
        mainDeck.filter(deckCard => deckCard.id === card.id).length < 3
      );
      addCard(material);
    });
    fill(monsterPool, MAIN_DECK_COMPOSITION.monster, 'monster');
    fill(allCards.filter(card =>
      isNormalSummonable(card) &&
      !monsterPool.some(themeCard => themeCard.id === card.id)
    ), MAIN_DECK_COMPOSITION.monster, 'monster');

    const spellPool = archetypeCards.filter(card => card.type.includes('Spell'));
    SUPPORTED_SPELLS.forEach(name => addCard(cardByName(name)));
    fill(spellPool, MAIN_DECK_COMPOSITION.spell, 'spell');
    fill(allCards.filter(card =>
      card.type.includes('Spell') &&
      !spellPool.some(themeCard => themeCard.id === card.id)
    ), MAIN_DECK_COMPOSITION.spell, 'spell');

    const trapPool = archetypeCards.filter(card => card.type.includes('Trap'));
    SUPPORTED_TRAPS.forEach(name => addCard(cardByName(name)));
    fill(trapPool, MAIN_DECK_COMPOSITION.trap, 'trap');
    fill(allCards.filter(card =>
      card.type.includes('Trap') &&
      !trapPool.some(themeCard => themeCard.id === card.id)
    ), MAIN_DECK_COMPOSITION.trap, 'trap');

    if (mainDeck.length !== 40) {
      throw new Error(`Unable to build a legal 40-card ${preset.label} deck.`);
    }

    const fusionNames = [...preset.fusionCards, ...GENERIC_FUSION_CARDS];
    const extraDeck = [];
    [...new Set(fusionNames)].forEach(name => {
      const card = cardByName(name);
      if (!card || !card.type.includes('Fusion') || extraDeck.length >= 15) return;
      const copies = mainDeck.filter(deckCard =>
        deckCard.name.toLocaleLowerCase() === card.name.toLocaleLowerCase()
      ).length;
      if (copies >= getCardCopyLimit(card)) return;
      extraDeck.push(this.convertApiCardToGameCard(card));
    });

    if (extraDeck.length === 0 || extraDeck.length > 15) {
      throw new Error(`No supported Fusion cards are available for the ${preset.label} deck.`);
    }

    return { mainDeck, extraDeck };
  }

  // Convert API card to game card format
  convertApiCardToGameCard(apiCard) {
    const baseCard = {
      id: apiCard.id,
      name: apiCard.name,
      type: this.determineCardType(apiCard),
      cardType: apiCard.type,
      archetype: apiCard.archetype || '',
      description: apiCard.desc,
      images: apiCard.card_images || []
    };

    if (baseCard.images.length > 0) {
      baseCard.images = baseCard.images.map(img => ({
        image_url: img.image_url,
        image_url_small: img.image_url_small || img.image_url
      }));
    }

    if (baseCard.type === 'monster') {
      return {
        ...baseCard,
        attribute: apiCard.attribute,
        level: apiCard.level,
        atk: apiCard.atk,
        def: apiCard.def,
        race: apiCard.race
      };
    }

    return baseCard;
  }

  determineCardType(apiCard) {
    const type = apiCard.type.toLowerCase();
    
    if (type.includes('monster')) {
      return 'monster';
    } else if (type.includes('spell')) {
      return 'spell';
    } else if (type.includes('trap')) {
      return 'trap';
    }
    
    return 'monster'; // Default fallback
  }

  // Generate a sample deck from API cards
  async generateSampleDeck() {
    console.log('Generating sample deck...');
    
    try {
      const allCards = await this.getAllCards();
      
      if (!allCards || allCards.length === 0) {
        console.error('No cards available from API, using fallback deck');
        return this.getFallbackDeck();
      }

      console.log(`Found ${allCards.length} cards from API`);
      const deck = [];
      
      const isNormalSummonable = (card) => {
        const cardType = card.type || '';
        const description = card.desc || '';
        return cardType.includes('Monster') &&
          !/(Fusion|Synchro|Xyz|XYZ|Link|Ritual|Pendulum|Token)/i.test(cardType) &&
          !/(cannot be normal summoned|cannot be normal set|must be special summoned)/i.test(description) &&
          Number.isFinite(card.level);
      };
      const monsters = allCards.filter(card =>
        isNormalSummonable(card) && card.atk >= 2000
      ).slice(0, 100);
      const lowLevelMonsters = allCards.filter(card =>
        isNormalSummonable(card) && card.level <= 4
      ).slice(0, 100);
      
      console.log(`Found ${monsters.length} powerful monsters`);
      
      // Get some spells (limit for performance)
      const spells = allCards.filter(card => 
        card.type && card.type.includes('Spell')
      ).slice(0, 50); // Limit to 50 spells
      
      console.log(`Found ${spells.length} spells`);
      
      // Get some traps (limit for performance)
      const traps = allCards.filter(card => 
        card.type && card.type.includes('Trap')
      ).slice(0, 50); // Limit to 50 traps
      
      console.log(`Found ${traps.length} traps`);

      if (monsters.length === 0 || lowLevelMonsters.length === 0 ||
          spells.length === 0 || traps.length === 0) {
        console.error('Not enough supported card types from API, using fallback deck');
        return this.getFallbackDeck();
      }

      const addRandomCopy = (pool) => {
        const eligibleCards = pool.filter(card =>
          deck.filter(deckCard => deckCard.id === card.id).length < 3
        );
        if (eligibleCards.length === 0) return false;

        const apiCard = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
        const card = this.convertApiCardToGameCard(apiCard);
        deck.push({ ...card, deckId: deck.length });
        return true;
      };

      // Ensure opening hands can include monsters that need no Tributes.
      for (let i = 0; i < 10; i++) {
        if (!addRandomCopy(lowLevelMonsters)) break;
      }

      // Add powerful monsters, including Tribute Summon options.
      for (let i = 0; i < 10; i++) {
        if (!addRandomCopy(monsters)) break;
      }

      // Add 10 spells
      for (let i = 0; i < 10; i++) {
        if (!addRandomCopy(spells)) break;
      }

      // Add 10 traps
      for (let i = 0; i < 10; i++) {
        if (!addRandomCopy(traps)) break;
      }

      // Keep the deck at 40 while respecting the three-copy limit.
      const cardPools = [lowLevelMonsters, monsters, spells, traps];
      while (deck.length < 40) {
        const pool = cardPools[Math.floor(Math.random() * cardPools.length)];
        if (!addRandomCopy(pool)) {
          const remainingPools = cardPools.filter(candidate =>
            candidate.some(card =>
              deck.filter(deckCard => deckCard.id === card.id).length < 3
            )
          );
          if (remainingPools.length === 0) break;
          if (!addRandomCopy(remainingPools[0])) break;
        }
      }

      console.log(`Generated deck with ${deck.length} cards`);
      
      // Final fallback - if somehow we still don't have cards
      if (deck.length !== 40) {
        console.error('Deck generation failed, using fallback');
        return this.getFallbackDeck();
      }
      
      return deck;
    } catch (error) {
      console.error('Error generating deck:', error.message);
      return this.getFallbackDeck();
    }
  }

  getFallbackDeck() {
    const fallbackCards = [
      { id: 1, name: 'Dark Magician', type: 'monster', attribute: 'DARK', level: 7, atk: 2500, def: 2100, description: 'The ultimate wizard in terms of attack and defense.', deckId: 0 },
      { id: 2, name: 'Blue-Eyes White Dragon', type: 'monster', attribute: 'LIGHT', level: 8, atk: 3000, def: 2500, description: 'This legendary dragon is a powerful engine of destruction.', deckId: 1 },
      { id: 3, name: 'Kuriboh', type: 'monster', attribute: 'DARK', level: 1, atk: 300, def: 200, description: 'A tiny, harmless creature.', deckId: 2 },
      { id: 4, name: 'Summoned Skull', type: 'monster', attribute: 'DARK', level: 6, atk: 2500, def: 1200, description: 'A fiendish monster from the netherworld.', deckId: 3 },
      { id: 5, name: 'Gemini Elf', type: 'monster', attribute: 'EARTH', level: 4, atk: 1900, def: 900, description: 'Twin elves who fight together.', deckId: 4 },
      { id: 6, name: 'Mystical Space Typhoon', type: 'spell', description: 'Destroy 1 Spell/Trap Card on the field.', deckId: 5 },
      { id: 7, name: 'Dark Hole', type: 'spell', description: 'Destroy all monsters on the field.', deckId: 6 },
      { id: 8, name: 'Monster Reborn', type: 'spell', description: 'Target 1 monster in either GY; Special Summon it.', deckId: 7 },
      { id: 9, name: 'Mirror Force', type: 'trap', description: 'When an opponent\'s monster declares an attack: Destroy all your opponent\'s Attack Position monsters.', deckId: 8 },
      { id: 10, name: 'Trap Hole', type: 'trap', description: 'When a monster(s) is Normal or Flip Summoned: Destroy that monster(s).', deckId: 9 },
      { id: 11, name: 'Feral Imp', type: 'monster', attribute: 'DARK', level: 4, atk: 1300, def: 1400, description: 'A playful little fiend that lurks in the dark.', deckId: 10 },
      { id: 12, name: 'Silver Fang', type: 'monster', attribute: 'EARTH', level: 3, atk: 1200, def: 800, description: 'A snow wolf that is beautiful to the eye, but absolutely vicious in battle.', deckId: 11 },
      { id: 13, name: 'Battle Ox', type: 'monster', attribute: 'EARTH', level: 4, atk: 1700, def: 1000, description: 'A monster with tremendous power, it destroys enemies with a swing of its axe.', deckId: 12 },
      { id: 14, name: 'Axe of Despair', type: 'spell', description: 'Equip only to a monster. It gains 1000 ATK.', deckId: 13 }
    ];

    return Array.from({ length: 40 }, (_, index) => ({
      ...fallbackCards[index === 39 ? 13 : Math.floor(index / 3)],
      deckId: index
    }));
  }
}

module.exports = new CardApiService();
