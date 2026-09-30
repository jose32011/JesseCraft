import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Database,
  Copy, Heart, Menu, MoreHorizontal, Pause, Play, Plus, RefreshCw, Search,
  Shield, Sparkles, Swords, Trophy, Users, Wifi, X
} from 'lucide-react';
import './styles.css';

const cards = [
  { name: 'Blue-Eyes White Dragon', type: 'Dragon / Normal', atk: '3000', def: '2500', color: 'blue', icon: '🐉' },
  { name: 'Mystical Elf', type: 'Spellcaster / Normal', atk: '800', def: '2000', color: 'violet', icon: '🧝' },
  { name: 'Cosmic Cyclone', type: 'Quick-Play Spell', atk: '—', def: '—', color: 'gold', icon: '✦' },
  { name: 'Sangan', type: 'Fiend / Effect', atk: '1000', def: '600', color: 'red', icon: '👹' },
  { name: 'Dark Magician', type: 'Spellcaster / Effect', atk: '2500', def: '2100', color: 'purple', icon: '🧙' },
];

const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const DUEL_SESSION_KEY = 'duel-links-active-session';

function readDuelSession() {
  try {
    const stored = localStorage.getItem(DUEL_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function mapApiCard(card) {
  const firstType = card.type?.split(' ')[0]?.toLowerCase() || 'blue';
  return {
    id: card.id,
    name: card.name,
    type: card.type || 'Unknown',
    atk: card.atk ?? '—',
    def: card.def ?? '—',
    color: firstType.includes('spell') ? 'gold' : firstType.includes('trap') ? 'violet' : 'blue',
    icon: card.attribute === 'DARK' ? '◈' : card.attribute === 'LIGHT' ? '✦' : '◆',
    image: card.card_images?.[0]?.image_url_small,
    imageLarge: card.card_images?.[0]?.image_url,
    description: card.desc || 'No card description available.',
    race: card.race || 'Unknown',
    attribute: card.attribute || '—',
    level: card.level,
    archetype: card.archetype,
  };
}

function LobbyView({ onBack, onStartDuel }) {
  const [name, setName] = useState(() => localStorage.getItem('duelist-name') || '');
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('connecting');
  const [notice, setNotice] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = new WebSocket(`${protocol}//${window.location.host}/ws`);
    connection.onopen = () => { setStatus('connected'); connection.send(JSON.stringify({ type: 'list_rooms' })); };
    connection.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'room_list') setRooms(message.rooms);
      if (message.type === 'room_created' || message.type === 'room_joined') {
        setRoomId(message.room.id);
        setNotice(message.type === 'room_created' ? 'Room created. Share the code with your opponent.' : 'Joined room. Waiting for the duel to start.');
      }
      if (message.type === 'room_started') onStartDuel(message.room);
      if (message.type === 'error') setNotice(message.message);
    };
    connection.onerror = () => setStatus('offline');
    connection.onclose = () => setStatus('offline');
    setSocket(connection);
    return () => connection.close();
  }, [onStartDuel]);

  const send = (payload) => {
    if (!name.trim()) { setNotice('Enter a duelist name first.'); return; }
    localStorage.setItem('duelist-name', name.trim());
    if (!socket || socket.readyState !== WebSocket.OPEN) { setNotice('Lobby connection is offline. Start the Replit server first.'); return; }
    socket.send(JSON.stringify({ ...payload, playerName: name.trim() }));
  };

  const refreshRooms = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice('Lobby connection is offline. You can still play against the AI.');
      return;
    }
    socket.send(JSON.stringify({ type: 'list_rooms' }));
  };

  return (
    <main className="app-shell lobby-shell">
      <header className="topbar"><div className="header-spacer" aria-hidden="true" /><div className="brand"><span className="brand-mark">✦</span><span>DUEL<span>·</span>LOBBY</span></div><div className={`connection-pill ${status}`}><Wifi size={13} /> {status === 'connected' ? 'ONLINE' : status.toUpperCase()}</div></header>
      <section className="lobby-hero"><p className="eyebrow">REAL-TIME MATCHMAKING</p><h1>Find a Duel</h1><p>Host a private room or join another duelist online.</p></section>
      <section className="lobby-profile"><label>Your duelist name<input value={name} onChange={(event) => setName(event.target.value.slice(0, 18))} placeholder="Enter a name" /></label><div className="lobby-actions"><button className="host-button" onClick={() => send({ type: 'create_room', roomName: roomName.trim() || `${name || 'Duelist'}'s Room` })}><Plus size={16} /> HOST GAME</button><label className="room-input"><input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Room name (optional)" /></label></div><button className="ai-button" onClick={() => { localStorage.setItem('duelist-name', name.trim() || 'Duelist'); onStartDuel({ mode: 'ai' }); }}><Swords size={16} /> PLAY AGAINST AI <span>OFFLINE</span></button></section>
      {roomId && <section className="room-code"><div><span>YOUR ROOM CODE</span><strong>{roomId}</strong></div><button onClick={() => navigator.clipboard?.writeText(roomId)}><Copy size={16} /> COPY</button></section>}
      {notice && <div className="lobby-notice">{notice}</div>}
      <section className="room-list-header"><span>OPEN ROOMS <b>{rooms.length}</b></span><button onClick={refreshRooms}><RefreshCw size={15} /> REFRESH</button></section>
      <section className="room-list">{rooms.length ? rooms.map((room) => <article className="room-item" key={room.id}><div className="room-icon"><Users size={19} /></div><div className="room-copy"><strong>{room.name}</strong><span>{room.hostName} · {room.players}/2 players</span></div><button disabled={room.players >= 2} onClick={() => send({ type: 'join_room', roomId: room.id })}>{room.players >= 2 ? 'FULL' : 'JOIN'}</button></article>) : <div className="empty-rooms"><Users size={28} /><p>No open rooms yet.</p><span>Be the first duelist to host a game.</span></div>}</section>
      <div className="lobby-footnote"><Shield size={14} /> Rooms are temporary and close when both duelists leave.</div>
    </main>
  );
}

function DatabaseView({ onBack, onAddCard }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [attribute, setAttribute] = useState('');
  const [apiCards, setApiCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadCards = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ num: '36', offset: '0' });
        if (query.trim()) params.set('fname', query.trim());
        if (type) params.set('type', type);
        const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('The card catalog is unavailable right now.');
        const data = await response.json();
        setApiCards((data.data || []).map(mapApiCard));
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }

    };
    const timer = setTimeout(loadCards, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, type]);

  const filteredCards = apiCards.filter((card) => !attribute || card.attribute === attribute);

  return (
    <main className="app-shell database-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="Back to duel"><ChevronLeft size={21} /></button>
        <div className="brand"><span className="brand-mark">✦</span><span>CARD<span>·</span>DATABASE</span></div>
        <button className="icon-button" aria-label="Close database" onClick={onBack}><X size={19} /></button>
      </header>
      <section className="database-heading">
        <div><p className="eyebrow">OFFICIAL CARD CATALOG</p><h1>Card Database</h1><p>Search the complete Yu-Gi-Oh! card catalog.</p></div>
        <div className="database-count"><Database size={17} /><b>LIVE</b><span>API</span></div>
      </section>
      <section className="database-controls">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards..." /></label>
        <div className="filter-row">
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Card type">
            <option value="">All types</option><option value="Normal Monster">Normal monsters</option><option value="Effect Monster">Effect monsters</option><option value="Spell Card">Spell cards</option><option value="Trap Card">Trap cards</option>
          </select>
          <select value={attribute} onChange={(event) => setAttribute(event.target.value)} aria-label="Attribute">
            <option value="">All attributes</option><option value="DARK">DARK</option><option value="LIGHT">LIGHT</option><option value="WIND">WIND</option><option value="FIRE">FIRE</option><option value="WATER">WATER</option><option value="EARTH">EARTH</option>
          </select>
        </div>
      </section>
      {loading && <div className="database-status"><span className="loader" />Loading cards from the catalog...</div>}
      {!loading && error && <div className="database-status error"><p>{error}</p><button onClick={() => setQuery(`${query} `)}>TRY AGAIN</button></div>}
      {!loading && !error && !filteredCards.length && <div className="database-status"><p>No cards match those filters.</p></div>}
      <section className="database-grid">
        {filteredCards.map((card) => (
          <button className="database-card" key={card.id} onClick={() => setActiveCard(card)}>
            <img src={card.image} alt="" /><div className="database-card-copy"><strong>{card.name}</strong><span>{card.type}</span><small>{card.attribute || card.race || 'CARD'}</small></div>
          </button>
        ))}
      </section>
      {activeCard && <div className="modal-backdrop" onClick={() => setActiveCard(null)}>
        <article className="card-detail" onClick={(event) => event.stopPropagation()}>
          <button className="detail-close" onClick={() => setActiveCard(null)}><X size={17} /></button>
          <img src={activeCard.imageLarge || activeCard.image} alt={activeCard.name} />
          <div className="detail-copy"><p className="eyebrow">{activeCard.attribute} · {activeCard.race}</p><h2>{activeCard.name}</h2><p className="detail-type">{activeCard.type}{activeCard.level ? ` · Level ${activeCard.level}` : ''}</p><p className="description">{activeCard.description}</p><div className="detail-stats"><span>ATK <b>{activeCard.atk}</b></span><span>DEF <b>{activeCard.def}</b></span></div><button className="add-card" onClick={() => { onAddCard(activeCard); setActiveCard(null); }}><Plus size={16} /> ADD TO DECK</button></div>
        </article>
      </div>}
    </main>
  );
}

function LifeBar({ player, points, max, accent }) {
  return (
    <div className={`life-card ${player === 'opponent' ? 'opponent' : ''}`}>
      <div className="life-top">
        <div className="avatar">{player === 'opponent' ? '👤' : '🧑‍🚀'}</div>
        <div>
          <strong>{player === 'opponent' ? 'Seto Kaiba' : 'Yugi Muto'}</strong>
          <div className="rank">{player === 'opponent' ? 'LEGEND 2' : 'ROOKIE 3'} <span>◆</span></div>
        </div>
        <div className="life-value"><Heart size={14} fill="currentColor" />{points.toLocaleString()}</div>
      </div>
      <div className="life-track"><div className={`life-fill ${accent}`} style={{ width: `${(points / max) * 100}%` }} /></div>
    </div>
  );
}

function Card({ card, selected, onClick, small = false }) {
  if (card.image) {
    return (
      <button className={`card dataset-card ${small ? 'field-card' : ''} ${selected ? 'selected' : ''}`} onClick={onClick}>
        <img className="full-card-image" src={card.imageLarge || card.image} alt={card.name} />
      </button>
    );
  }

  return (
    <button className={`card ${card.color} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`} onClick={onClick}>
      <div className="card-title">{card.name}</div>
      <div className="art">{card.image ? <img src={card.image} alt="" /> : card.icon}<span className="shine" /></div>
      <div className="card-type">{card.type}</div>
      <div className="stats"><span>ATK {card.atk}</span><span>DEF {card.def}</span></div>
    </button>
  );
}

function FieldSlot({ card, faceDown = false, selected = false, onClick }) {
  return (
    card && !faceDown
      ? <div className="field-slot occupied"><Card card={card} small selected={selected} onClick={onClick} /></div>
      : <button className={`field-slot ${faceDown && card ? 'face-down-card' : ''} ${selected ? 'selected' : ''}`} onClick={onClick} aria-label={faceDown && card ? `Select your face-down card ${card.name}` : undefined}>{faceDown ? <div className="deck-back">✦</div> : <span className="slot-plus">+</span>}</button>
  );
}

function App() {
  const [savedSession] = useState(readDuelSession);
  const [view, setView] = useState(savedSession?.view === 'duel' ? 'duel' : 'lobby');
  const [turn, setTurn] = useState(savedSession?.turn || 1);
  const [phase, setPhase] = useState(savedSession?.phase || 'DRAW PHASE');
  const [points, setPoints] = useState(savedSession?.points || { you: 8000, opponent: 8000 });
  const [selected, setSelected] = useState(savedSession?.selected || null);
  const [message, setMessage] = useState(savedSession?.message || 'Your first turn — draw is skipped. Summon a monster or set a card.');
  const [paused, setPaused] = useState(false);
  const [hand, setHand] = useState(savedSession?.hand || cards);
  const [fieldCard, setFieldCard] = useState(savedSession?.fieldCard || cards[4]);
  const [yourMonster, setYourMonster] = useState(savedSession?.yourMonster || null);
  const [yourBackrow, setYourBackrow] = useState(savedSession?.yourBackrow || []);
  const [deckCount, setDeckCount] = useState(savedSession?.deckCount || 35);
  const [normalSummoned, setNormalSummoned] = useState(savedSession?.normalSummoned || false);
  const [gameOver, setGameOver] = useState(savedSession?.gameOver || '');
  const [datasetCards, setDatasetCards] = useState([]);
  const [cardDataLoading, setCardDataLoading] = useState(true);
  const [viewedCard, setViewedCard] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadDuelCards = async () => {
      try {
        const [monsterResponse, spellResponse] = await Promise.all([
          fetch(`${API_URL}?type=Effect%20Monster&num=12&offset=0`, { signal: controller.signal }),
          fetch(`${API_URL}?type=Spell%20Card&num=8&offset=0`, { signal: controller.signal }),
        ]);
        if (!monsterResponse.ok || !spellResponse.ok) throw new Error('Card dataset request failed.');
        const [monsterData, spellData] = await Promise.all([monsterResponse.json(), spellResponse.json()]);
        const monsters = (monsterData.data || []).map(mapApiCard).filter((card) => card.image);
        const spells = (spellData.data || []).map(mapApiCard).filter((card) => card.image);
        const datasetCards = [...monsters, ...spells];
        if (datasetCards.length >= 6) {
          setDatasetCards(datasetCards);
          if (!savedSession) {
            setHand([monsters[0], monsters[1], spells[0], spells[1], monsters[2]]);
            setFieldCard(monsters[3]);
            setMessage('Live card dataset loaded — your move.');
          }
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setMessage('Offline card set loaded — your move.');
      } finally {
        if (!controller.signal.aborted) setCardDataLoading(false);
      }
    };
    loadDuelCards();
    return () => controller.abort();
  }, [savedSession]);

  useEffect(() => {
    if (view !== 'duel') return;
    try {
      localStorage.setItem(DUEL_SESSION_KEY, JSON.stringify({
        view,
        turn,
        phase,
        points,
        selected,
        message,
        hand,
        fieldCard,
        yourMonster,
        yourBackrow,
        deckCount,
        normalSummoned,
        gameOver,
      }));
    } catch {
      setMessage('Duel is active, but this browser could not save the session.');
    }
  }, [view, turn, phase, points, selected, message, hand, fieldCard, yourMonster, yourBackrow, deckCount, normalSummoned, gameOver]);

  const summon = () => {
    if (!selected) {
      setMessage('Select a card from your hand first.');
      return;
    }
    if (phase !== 'MAIN PHASE' && phase !== 'MAIN PHASE 2') {
      setMessage('You can only summon or set cards during a Main Phase.');
      return;
    }
    if (normalSummoned) {
      setMessage('You have already used your Normal Summon this turn.');
      return;
    }
    const isMonster = selected.type?.includes('Monster') || selected.atk !== '—';
    if (!isMonster) {
      setMessage('That card is not a monster. Use it as a Spell/Trap instead.');
      return;
    }
    if (yourMonster) {
      setMessage('Your Monster Zone is occupied. Tribute Summons are not enabled in this duel yet.');
      return;
    }
    setYourMonster(selected);
    setNormalSummoned(true);
    setMessage(`${selected.name} was Normal Summoned in Attack Position.`);
    setHand((current) => current.filter((card) => card.name !== selected.name));
    setSelected(null);
  };

  const setCard = () => {
    if (!selected) {
      setMessage('Select a Spell or Trap from your hand first.');
      return;
    }
    if (!['MAIN PHASE', 'MAIN PHASE 2'].includes(phase)) {
      setMessage('You can only set cards during a Main Phase.');
      return;
    }
    const isMonster = selected.type?.includes('Monster') || selected.atk !== '—';
    if (isMonster) {
      setMessage('Monster Cards must be summoned, not set as Spell/Trap cards.');
      return;
    }
    if (yourBackrow.length >= 5) {
      setMessage('Your Spell/Trap Zones are full.');
      return;
    }
    setYourBackrow((current) => [...current, selected]);
    setHand((current) => current.filter((card) => card.name !== selected.name));
    setSelected(null);
    setMessage(`${selected.name} was Set face-down.`);
  };

  const attack = () => {
    if (phase !== 'BATTLE PHASE') {
      setMessage('Attacks can only be declared during the Battle Phase.');
      return;
    }
    if (!yourMonster) {
      setMessage('You need an Attack Position monster to declare an attack.');
      return;
    }
    const attacker = Number(yourMonster.atk) || 0;
    const defender = Number(fieldCard?.atk) || 0;
    if (!fieldCard) {
      damageOpponent(attacker, `Direct attack! ${yourMonster.name} dealt ${attacker.toLocaleString()} damage.`);
      return;
    }
    if (attacker > defender) {
      damageOpponent(attacker - defender, `${yourMonster.name} destroyed ${fieldCard.name}. Kaiba took ${(attacker - defender).toLocaleString()} battle damage.`);
      setFieldCard(null);
    } else if (attacker < defender) {
      damageYou(defender - attacker, `${yourMonster.name} was destroyed. You took ${(defender - attacker).toLocaleString()} battle damage.`);
      setYourMonster(null);
    } else {
      setMessage('Both monsters have equal ATK. Both are destroyed.');
      setFieldCard(null);
      setYourMonster(null);
    }
  };

  const damageOpponent = (amount, text) => {
    setPoints((current) => {
      const next = Math.max(0, current.opponent - amount);
      if (next === 0) setGameOver('You win! Seto Kaiba’s Life Points reached 0.');
      return { ...current, opponent: next };
    });
    setMessage(text);
  };

  const damageYou = (amount, text) => {
    setPoints((current) => {
      const next = Math.max(0, current.you - amount);
      if (next === 0) setGameOver('Duel over — your Life Points reached 0.');
      return { ...current, you: next };
    });
    setMessage(text);
  };

  const nextPhase = () => {
    const phases = ['DRAW PHASE', 'STANDBY PHASE', 'MAIN PHASE', 'BATTLE PHASE', 'MAIN PHASE 2', 'END PHASE'];
    const next = phases[(phases.indexOf(phase) + 1) % phases.length];
    setPhase(next);
    if (next === 'DRAW PHASE') {
      if (deckCount <= 0) {
        setGameOver('Duel over — you could not draw a card.');
        setMessage('Deck out! You have no cards left to draw.');
      } else if (turn > 1) {
        setDeckCount((count) => count - 1);
        const draw = datasetCards.find((card) => !hand.some((held) => held.id === card.id)) || cards[0];
        setHand((current) => [...current, draw]);
        setMessage(`Draw Phase — you drew ${draw.name}.`);
      } else {
        setMessage('Draw Phase skipped on the first player’s first turn.');
      }
    } else {
      setMessage(next === 'END PHASE' ? 'Turn ended. Ready for the next turn.' : `${next} — choose your action.`);
    }
    if (next === 'MAIN PHASE') setNormalSummoned(false);
    if (next === 'END PHASE') {
      setTurn((value) => value + 1);
      setNormalSummoned(false);
    }
  };

  const quitToLobby = () => {
    setPaused(false);
    setGameOver('');
    localStorage.removeItem(DUEL_SESSION_KEY);
    setView('lobby');
  };

  const startNewGame = () => {
    localStorage.removeItem(DUEL_SESSION_KEY);
    window.location.reload();
  };

  if (view === 'database') return <DatabaseView onBack={() => setView('duel')} onAddCard={(card) => setMessage(`${card.name} added to your deck.`)} />;
  if (view === 'lobby') return <LobbyView onBack={() => setView('duel')} onStartDuel={() => setView('duel')} />;

  return (
    <main className="app-shell battlefield-shell">
      <header className="topbar">
        <button className="icon-button pause-menu-button" onClick={() => setPaused(true)}><Menu size={20} /></button>
        <div className="brand"><span className="brand-mark">✦</span><span>DUEL<span>·</span>LINKS</span></div>
        <div className="header-actions"><button className="icon-button" onClick={() => setView('lobby')} aria-label="Open online lobby"><Users size={18} /></button><button className="icon-button"><Bell size={18} /><i /></button><button className="icon-button" onClick={() => setView('database')} aria-label="Open card database"><Database size={18} /></button></div>
      </header>

      <section className="duel-header">
        <div className="turn-label"><span>TURN</span><b>{turn}</b></div>
        <div className="phase-pill"><span className="pulse" />{phase}<ChevronDown size={14} /></div>
        <div className="timer"><span>00</span>:<b>42</b></div>
      </section>

      <section className="players battlefield-players">
        <LifeBar player="opponent" points={points.opponent} max={8000} accent="red-fill" />
        <div className="versus"><Swords size={16} /><span>VS</span></div>
        <LifeBar player="you" points={points.you} max={8000} accent="cyan-fill" />
      </section>

      <section className="duel-board">
        <div className="board-label opponent-label"><span>OPPONENT'S FIELD</span><b>DECK 18</b></div>
        <div className="board-grid opponent-zone">
          <div className="monster-row"><FieldSlot card={null} faceDown /><FieldSlot card={fieldCard} selected={selected?.name === fieldCard?.name} onClick={() => fieldCard && setSelected(fieldCard)} /><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /></div>
          <div className="spell-row"><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /></div>
        </div>
        <div className="field-divider phase-track"><span>DP</span><span>SP</span><b>MP1</b><span>BP</span><span>MP2</span><span>EP</span></div>
        <div className="board-grid your-zone">
          <div className="monster-row"><FieldSlot card={yourMonster} selected={selected?.name === yourMonster?.name} onClick={() => yourMonster && setSelected(yourMonster)} /><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /><FieldSlot card={null} /></div>
          <div className="spell-row">{[0, 1, 2, 3, 4].map((slot) => {
            const backrowCard = yourBackrow[slot] || null;
            return <FieldSlot key={slot} card={backrowCard} faceDown={Boolean(backrowCard)} selected={selected?.name === backrowCard?.name} onClick={() => backrowCard && setSelected(backrowCard)} />;
          })}</div>
        </div>
        <div className="board-label your-label"><span>YOUR FIELD</span><b>DECK {deckCount}</b></div>
      </section>

      <section className="message-bar"><Sparkles size={15} /><span>{message}</span><button onClick={() => setMessage('Tip: Summon a monster before entering the Battle Phase.')}><CircleHelp size={16} /></button></section>

      <section className="hand-area battlefield-hand">
        <div className="hand-header"><span>YOUR HAND {cardDataLoading && <span className="dataset-dot" title="Loading live card dataset" />}<b>{hand.length}</b></span><span className="graveyard"><span className="grave-icon">◈</span> GRAVEYARD <b>03</b></span></div>
        <div className="hand-cards">{hand.map((card) => <Card key={card.name} card={card} selected={selected?.name === card.name} onClick={() => setSelected(card)} />)}</div>
      </section>

      <footer className="action-bar">
        <button className="action secondary" onClick={() => setPaused(true)} aria-label="Pause duel" title="Pause duel"><Pause size={18} /></button>
        <button className="action view-card" disabled={!selected} onClick={() => setViewedCard(selected)} aria-label="View selected card" title="View selected card"><Search size={18} /></button>
        <button className="action summon" onClick={() => (selected?.type?.includes('Monster') || selected?.atk !== '—' ? summon() : setCard())} aria-label="Play or set selected card" title="Play or set selected card"><Shield size={18} /></button>
        <button className="action attack" onClick={attack} aria-label="Attack" title="Attack"><Swords size={18} /></button>
        <button className="action next" onClick={nextPhase} aria-label="Next phase" title="Next phase"><ChevronRight size={20} /></button>
      </footer>

      {paused && <div className="modal-backdrop"><div className="pause-modal"><div className="modal-icon"><Pause /></div><h2>Duel paused</h2><p>Take a breath, duelist. Your match is waiting.</p><button onClick={() => setPaused(false)}><Play size={16} /> RESUME DUEL</button><div className="modal-actions"><button className="modal-secondary" onClick={quitToLobby}><Users size={16} /> QUIT TO LOBBY</button><button className="modal-secondary" onClick={startNewGame}><RefreshCw size={16} /> NEW GAME</button></div></div></div>}
      {viewedCard && <div className="modal-backdrop" onClick={() => setViewedCard(null)}>
        <article className="card-detail" onClick={(event) => event.stopPropagation()}>
          <button className="detail-close" onClick={() => setViewedCard(null)} aria-label="Close card details"><X size={17} /></button>
          {viewedCard.imageLarge || viewedCard.image
            ? <img src={viewedCard.imageLarge || viewedCard.image} alt={viewedCard.name} />
            : <div className={`fallback-detail-art ${viewedCard.color}`}>{viewedCard.icon}</div>}
          <div className="detail-copy">
            <p className="eyebrow">{viewedCard.attribute || 'CARD'} · {viewedCard.race || 'DUEL CARD'}</p>
            <h2>{viewedCard.name}</h2>
            <p className="detail-type">{viewedCard.type}{viewedCard.level ? ` · Level ${viewedCard.level}` : ''}</p>
            <p className="description">{viewedCard.description || 'No card description available.'}</p>
            <div className="detail-stats"><span>ATK <b>{viewedCard.atk}</b></span><span>DEF <b>{viewedCard.def}</b></span></div>
          </div>
        </article>
      </div>}
      {gameOver && <div className="modal-backdrop"><div className="pause-modal result-modal"><div className="modal-icon"><Trophy size={22} /></div><h2>{gameOver.startsWith('You win') ? 'Victory!' : 'Duel finished'}</h2><p>{gameOver}</p><button onClick={startNewGame}><Play size={16} /> NEW GAME</button><button className="modal-secondary standalone" onClick={quitToLobby}><Users size={16} /> QUIT TO LOBBY</button></div></div>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
