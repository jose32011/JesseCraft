const cardApi = require('./cardApi');

async function testApi() {
    console.log('=== Testing Yu-Gi-Oh API ===\n');
    
    try {
        // Test 1: Get all cards
        console.log('Test 1: Fetching all cards...');
        const allCards = await cardApi.getAllCards();
        console.log(`✓ Found ${allCards.length} cards`);
        
        if (allCards.length > 0) {
            console.log(`  Sample card: ${allCards[0].name}`);
        }
        
        // Test 2: Get random card
        console.log('\nTest 2: Fetching random card...');
        const randomCard = await cardApi.getRandomCard();
        if (randomCard) {
            console.log(`✓ Random card: ${randomCard.name}`);
        } else {
            console.log('✗ Failed to get random card');
        }
        
        // Test 3: Search for specific card
        console.log('\nTest 3: Searching for Dark Magician...');
        const darkMagician = await cardApi.getCardByName('Dark Magician');
        if (darkMagician) {
            console.log(`✓ Found: ${darkMagician.name} (ATK: ${darkMagician.atk})`);
        } else {
            console.log('✗ Failed to find Dark Magician');
        }
        
        // Test 4: Generate sample deck
        console.log('\nTest 4: Generating sample deck...');
        const deck = await cardApi.generateSampleDeck();
        console.log(`✓ Generated deck with ${deck.length} cards`);
        
        if (deck.length > 0) {
            console.log(`  Sample deck card: ${deck[0].name}`);
            console.log(`  Deck types: ${deck.map(c => c.type).join(', ')}`);
        }
        
        // Test 5: Card conversion
        console.log('\nTest 5: Testing card conversion...');
        if (allCards.length > 0) {
            const convertedCard = cardApi.convertApiCardToGameCard(allCards[0]);
            console.log(`✓ Converted: ${convertedCard.name}`);
            console.log(`  Type: ${convertedCard.type}`);
            if (convertedCard.type === 'monster') {
                console.log(`  ATK/DEF: ${convertedCard.atk}/${convertedCard.def}`);
            }
        }
        
        console.log('\n=== All Tests Passed ===');
        
    } catch (error) {
        console.error('\n=== Test Failed ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testApi();
