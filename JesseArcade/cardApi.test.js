const assert = require('node:assert/strict');
const test = require('node:test');
const cardApi = require('./cardApi');

function card(id, name, type, archetype = 'Toon', extra = {}) {
  return {
    id,
    name,
    type,
    archetype,
    desc: '',
    card_images: [],
    ...extra
  };
}

test('themed main decks use a monster-forward 26/8/6 composition', async () => {
  const originalGetAllCards = cardApi.getAllCards;
  const monsters = Array.from({ length: 36 }, (_, index) =>
    card(1000 + index, `Toon Monster ${index}`, 'Effect Monster', 'Toon', {
      attribute: index % 2 ? 'LIGHT' : 'DARK',
      race: index % 2 ? 'Spellcaster' : 'Dragon',
      level: 4,
      atk: 1500 + index,
      def: 1000
    })
  );
  const spells = Array.from({ length: 20 }, (_, index) =>
    card(2000 + index, `Toon Spell ${index}`, 'Spell Card', 'Toon')
  );
  const traps = Array.from({ length: 20 }, (_, index) =>
    card(3000 + index, `Toon Trap ${index}`, 'Trap Card', 'Toon')
  );
  const fusion = card(4000, 'Mudragon of the Swamp', 'Fusion Monster', '', {
    banlist_info: {}
  });

  cardApi.getAllCards = async () => [...monsters, ...spells, ...traps, fusion];
  try {
    const { mainDeck } = await cardApi.generateThemedDeck('Toon');
    assert.equal(mainDeck.length, 40);
    assert.equal(mainDeck.filter(entry => entry.type === 'monster').length, 26);
    assert.equal(mainDeck.filter(entry => entry.type === 'spell').length, 8);
    assert.equal(mainDeck.filter(entry => entry.type === 'trap').length, 6);
    assert.ok(mainDeck.every(entry =>
      mainDeck.filter(other => other.name === entry.name).length <= 3
    ));
  } finally {
    cardApi.getAllCards = originalGetAllCards;
  }
});
