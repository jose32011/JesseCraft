# Jesse Arcade

A browser-based game arcade featuring JesseCraft, Yu-Gi-Oh!, multiplayer Ludo, online 3D-styled Chess, Snakes and Ladders, and UNO.

## Features

- **Game Menu**: Select JesseCraft, Yu-Gi-Oh!, Ludo, Chess, Snakes and Ladders, or UNO
- **JesseCraft**: Launch the multiplayer voxel-building game from the same arcade menu and server
- **Multiplayer Support**: Play Yu-Gi-Oh!, Ludo, or Chess online with another player
- **Online Chess**: Real-time two-player rooms with server-validated moves and reconnectable player seats
- **Chess Rules**: Powered by chess.js, including castling, en passant, promotion, checkmate, stalemate, and draw rules
- **3D Chessboard**: Perspective board, raised chess pieces, selection hints, check highlighting, and move history
- **Ludo Modes**: Play two-player online without AI, play against an AI opponent, or play with a friend and two AI players
- **Ludo Rules**: Roll six to leave base, exact rolls to finish, captures, safe spaces, extra turns on six, and a server-controlled AI
- **Themed Deck Selection**: Choose a complete Blue-Eyes, Toon, Dark Magician, Cyber Dragon, Elemental HERO, Red-Eyes, or Dragonmaid deck
- **Ready-Up Lobby**: Both players see each other's selected deck and must ready up before the duel starts
- **Refresh Recovery**: Rejoining from the same browser restores your seat and current duel state
- **Real Yu-Gi-Oh Cards**: Fetches actual cards from the YGOPRODeck API with images
- **Mobile Optimized**: Fully responsive design with touch controls for mobile devices
- **Full Game Board**: Complete Yu-Gi-Oh field layout with:
  - 5 Monster Zones
  - 5 Spell/Trap Zones
  - Field Zone
  - Graveyard
  - Deck and Extra Deck
- **Turn-Based Gameplay**: Proper turn phases (Draw, Standby, Main 1, Battle, Main 2, End)
- **Card Management**: 
  - Draw cards from deck
  - Summon monsters in attack or defense position, or set them face-down in defense
  - Activate spells face-up or set spell/trap cards
  - Attack opponent's monsters or direct attack
- **Supported Effects**: Resolve Dark Hole, Monster Reborn, Mystical Space Typhoon, Mirror Force, and Trap Hole
- **Fusion Summoning**: Use Polymerization and supported Fusion recipes; materials may be selected from the hand or face-up field as permitted by the recipe
- **Prebuilt Decks**: Each selection loads a generated 40-card Main Deck and matching Extra Deck
- **Life Points System**: Track player life points (starting at 8000)
- **Card Images**: Displays actual card artwork from the API with mobile-optimized sizing
- **Smart Caching**: Cards are cached for 24 hours to reduce API calls
- **Touch-Friendly**: Optimized touch controls and gestures for mobile gameplay

## Installation

1. Make sure you have Node.js installed.

2. Install both projects' dependencies from the JesseCraft project root:
```bash
npm install
npm install --prefix JesseArcade
```

## Running the Arcade

Build and start both games from the JesseCraft project root:
```bash
npm install
npm install --prefix JesseArcade
npm run build:arcade
npm start
```

The arcade, including JesseCraft, will be available at `http://localhost:3000`. JesseCraft's browser app is built at `/jesse-craft/`, and its multiplayer connection uses the arcade server.

## How to Play

### Getting Started

1. Open the game in your browser (works on desktop and mobile)
2. Enter your player name
3. Enter a room ID (use the same room ID as your opponent to play together)
4. Select Yu-Gi-Oh! from the game menu
5. Choose a complete themed deck and click "Join Duel Room"

### Ludo

1. Select Ludo from the game menu.
2. Enter your name and a room ID. For an online game, both players must use the same room ID and mode.
3. Choose **2 players online (no AI)** to play with one other person, **Play against AI** for a one-player game, or **2 online players + 2 AI players** for a four-seat game.
4. Roll the die. Roll a six to bring a piece out of base, select a highlighted piece to move, and be the first to move all four pieces home.

Ludo game state is managed by the server while it is running. As with Yu-Gi-Oh!, active games are not saved across server restarts, and a multi-replica deployment needs shared game-state storage.

### Chess

1. Select Chess from the game menu.
2. Enter your player name and a room ID. Both players must use the same room ID.
3. White moves first. Select one of your pieces and then a highlighted destination square. Choose a promotion piece when a pawn reaches the last rank.

Chess uses `chess.js` on the server as the authority for legal moves and game results. Room state is held in server memory; Railway deployments should use a single app instance unless shared state storage is added.

### Mobile Controls

- **Tap cards** in your hand to view details and play them
- **Tap empty zones** to place cards
- **Tap your monsters** during Battle Phase to attack
- **Tap opponent's monsters** to target them for attacks
- **Swipe** through your hand if you have many cards
- Card artwork stays visible on mobile; tap a card to view its full-size image and details

### Lobby and Starting a Game

- Both players must join the same room and select a themed deck. The game generates that complete deck when both players ready up.
- Review both deck selections and click "Ready Up". The duel begins once both players are ready.
- Each player starts with 8000 Life Points and a 5-card opening hand. The first player does not draw on their first turn; the second player draws when their first Draw Phase begins.
- Refreshing or briefly disconnecting reconnects you to the same room using browser storage. The duel state remains in server memory, so restarting the server still ends all active duels.

### Turn Phases

Each turn consists of these phases:

1. **Draw Phase**: Draw 1 card from your deck (except the first player on their first turn). If required to draw from an empty Deck, you lose.
2. **Standby Phase**: No actions (card effects would resolve here)
3. **Main Phase 1**: 
   - Normal Summon or Set one monster per turn
   - Tribute 1 monster for a Level 5-6 monster, or 2 for Level 7+
   - Set spell/trap cards
   - Activate spell cards
4. **Battle Phase**:
   - Attack opponent's monsters
   - Direct attack if opponent has no monsters
5. **Main Phase 2**:
   - Play cards using actions still available this turn; a Normal Summon/Set already used this turn cannot be used again
6. **End Phase**: Turn ends, opponent's turn begins

### Card Actions

#### Playing Monsters
- Click on a monster card in your hand
- Choose attack position, face-up defense position, or set defense position in the modal
- For Level 5 or higher, select the required monsters to Tribute, then select a Monster Zone
- An Attack Position monster Summoned before the Battle Phase can attack that turn, except during the first player's opening turn. Defense Position monsters cannot attack.

#### Playing Spells/Traps
- Click a spell/trap card in your hand
- Supported spells can be activated from the hand; other spells can be placed face-up (their effects are not implemented) or set. Traps are set face-down.
- Click on an empty spell/trap zone to place the card
- **Dark Hole** destroys all monsters on both fields.
- **Monster Reborn** revives a monster from either Graveyard to your field.
- **Mystical Space Typhoon** destroys a selected Spell/Trap on either field.
- **Mirror Force** destroys the opponent's Attack Position monsters when they declare an attack; **Trap Hole** destroys a qualifying Normal Summon. Both traps must be set on an earlier turn.

#### Fusion Summoning
- Polymerization must be in your hand. Open the Extra Deck during your Main Phase, choose a supported Fusion Monster, select its materials, and choose a Monster Zone.
- Supported themed recipes: Blue-Eyes Twin Burst Dragon (2 Blue-Eyes White Dragons) and Blue-Eyes Alternative Ultimate Dragon (3); Dark Cavalry (Dark Magician + Warrior) and Amulet Dragon (Dark Magician + Dragon); Cyber Twin Dragon (2 Cyber Dragons); Elemental HERO Flame Wingman (Avian + Burstinatrix) and Elemental HERO Absolute Zero (HERO + WATER); Meteor Black Dragon (Red-Eyes Black Dragon + Meteor Dragon); Dragonmaid Sheou (Dragonmaid + Level 5 or higher Dragon) and House Dragonmaid (Dragonmaid + Dragon).
- Only the explicitly supported Fusion recipes resolve. Other Extra Deck monsters and card text remain visible but do not have working effects. Supported Fusion monsters leave the Extra Deck when summoned; materials and Polymerization go to the Graveyard.

#### Attacking
- During Battle Phase, click on one of your monsters that can attack (highlighted in gold), then click an opponent's monster to attack it.
- If the opponent has no monsters, choose **Direct Attack** or tap an empty opposing Monster Zone.
- Monsters Summoned in Attack Position during your Main Phase can attack that turn; the first player cannot attack on their opening turn.

### Combat Rules

- Attacks can only be declared during the Battle Phase; each face-up Attack Position monster can attack once per turn.
- **ATK vs ATK**: Higher ATK destroys the lower ATK monster. Difference in ATK is dealt as damage to the player controlling the weaker monster.
- **ATK vs DEF**: If ATK exceeds DEF, the Defense Position monster is destroyed with no battle damage. If DEF is higher, the attacking player takes the difference as damage.
- **Equal ATK**: Both monsters are destroyed.
- **Direct Attack**: If opponent has no monsters, attack directly and deal your monster's ATK as damage.

### Winning

The game ends when a player's Life Points reach 0 or they must draw from an empty Deck.

### Rules coverage

The target is the official TCG rules in the [official rulebook](https://www.yugioh-card.com/en/rulebook/) and [official rules updates](https://www.yugioh-card.com/en/play/2021_rules_update/). Choose from complete generated themed decks; individual card-by-card deck editing is not part of the current interface. This does **not** yet make the duel engine a complete TCG simulator: only the specifically listed card effects and Fusion recipes resolve; chains, response windows, Flip Summons, battle-position changes, Ritual/Synchro/Xyz/Pendulum/Link Summons, Side Deck swaps between games, and most card effects remain unimplemented. The field also does not yet implement the full modern Extra Monster Zone/Pendulum layout.

## Card Database

The game uses the [YGOPRODeck API](https://db.ygoprodeck.com/api/v7/) to fetch real Yu-Gi-Oh cards:

- **Themed Deck Generation**: Builds a ready-to-play Main Deck and matching Extra Deck for the selected archetype
- **Card Images**: Displays actual card artwork
- **Complete Card Data**: Includes attributes, levels, ATK/DEF, and card descriptions
- **Explicit API Errors**: If the card API is unavailable or the selected themed deck cannot be built, the lobby reports the error rather than substituting a different deck
- **Caching**: Cards are cached for 24 hours to improve performance and reduce API calls

The API is free to use and requires no authentication. Please respect their rate limits (20 requests per second per IP).

## Technical Details

- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.io
- **Card Data**: YGOPRODeck API (https://db.ygoprodeck.com/api/v7/)
- **HTTP Client**: Axios for API requests
- **Frontend**: Vanilla JavaScript with HTML/CSS
- **No Framework Dependencies**: Pure JS for maximum compatibility

## File Structure

```
YUGIOH/
├── server.js           # Game server and logic
├── cardApi.js          # YGOPRODeck API integration
├── package.json        # Dependencies and scripts
├── public/
│   ├── index.html      # Game UI
│   ├── style.css       # Styling
│   └── game.js         # Client-side game logic
└── README.md          # This file
```

## Future Enhancements

Remaining official TCG features include:
- Full chain and response timing
- Complete card effect resolution
- Flip, Ritual, Synchro, Xyz, Pendulum, and Link Summoning
- Side Deck swaps between games in a Match
- Modern Extra Monster Zone and Pendulum Zone rules

- - Robot Wars and UNO are currently menu entries and are not playable yet.
- Sound effects
- Chat system
- Spectator mode
- Replays
- Card collection database

## Troubleshooting

**Port already in use:**
- Change the port in server.js by modifying the PORT variable
- Or kill the process using port 3000 (Windows: `taskkill //F //PID <process_id>`, Mac/Linux: `kill <process_id>`)

**Players can't connect:**
- Ensure both players are using the same room ID
- Check that the server is running
- Verify firewall settings allow WebSocket connections

**Game not updating:**
- Refresh the page to reconnect
- Check browser console for errors

**Cards not loading:**
- Check your internet connection (API requires internet access)
- If API is down, the game will use fallback cards
- Check server logs for API errors

**API Rate Limiting:**
- The YGOPRODeck API has a rate limit of 20 requests per second
- The game implements caching to minimize API calls
- If you get rate-limited, wait a few minutes before restarting

## License

This is a fan-made project for educational purposes. Yu-Gi-Oh is a trademark of Konami.
#   J e s s e A r c a d e  
 