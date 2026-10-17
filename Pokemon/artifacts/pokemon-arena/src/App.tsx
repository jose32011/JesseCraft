import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleUserRound,
  Copy,
  Crosshair,
  Crown,
  Gauge,
  Loader2,
  LogIn,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Swords,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey,
  getGetLobbyQueryKey,
  getListLobbiesQueryKey,
  getListPlayersQueryKey,
  useCreateLobby,
  useCreatePlayer,
  useDeletePlayer,
  useGetDashboardSummary,
  useGetLobby,
  useJoinLobby,
  useListLobbies,
  useListPlayers,
  usePublishBattleEvent,
  useSaveTeam,
  useStartBattle,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { POKEMON_CATALOG } from './pokemon-catalog';
import { pokemonTypeForId } from './pokemon-types';

const queryClient = new QueryClient();
const HERO_ASSET = `${import.meta.env.BASE_URL}assets/pokemon-legends-z-a-169-en_1789281700053.webp`;
const BATTLE_ASSET = `${import.meta.env.BASE_URL}assets/pokemon-battle-background-p7tfrd8tyzo0cxm0_1789281700055.webp`;
const SPRITE = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const TEAM_SIZE = 7;

type LocalPokemon = { id: number; name: string; type: string; hp: number; image: string };
const FEATURED_POKEMON: LocalPokemon[] = ([
  [25, 'Pikachu', 'electric', 274], [6, 'Charizard', 'fire / flying', 360], [94, 'Gengar', 'ghost / poison', 324],
  [131, 'Lapras', 'water / ice', 390], [448, 'Lucario', 'fighting / steel', 344], [197, 'Umbreon', 'dark', 336],
  [445, 'Garchomp', 'dragon / ground', 374], [724, 'Decidueye', 'grass / ghost', 330], [282, 'Gardevoir', 'psychic / fairy', 320],
  [59, 'Arcanine', 'fire', 342], [143, 'Snorlax', 'normal', 494], [658, 'Greninja', 'water / dark', 322],
] as const).map(([id, name, type, hp]) => ({ id, name, type, hp, image: SPRITE(id) }));
const POKEMON: LocalPokemon[] = POKEMON_CATALOG.map(([id, name]) => {
  const featured = FEATURED_POKEMON.find((pokemon) => pokemon.id === id);
  return featured ?? { id, name, type: pokemonTypeForId(id), hp: 300 + (id % 120), image: SPRITE(id) };
});

const typeTone: Record<string, string> = {
  electric: 'bg-[#e7b63f]/15 text-[#f6d46e] border-[#e7b63f]/35',
  fire: 'bg-[#e76557]/15 text-[#ff9a88] border-[#e76557]/35',
  water: 'bg-[#4ba6d2]/15 text-[#85d4f3] border-[#4ba6d2]/35',
  ghost: 'bg-[#9a7ed0]/15 text-[#c9b5ff] border-[#9a7ed0]/35',
  dark: 'bg-[#69738e]/15 text-[#abb6ce] border-[#69738e]/35',
  dragon: 'bg-[#bf76e2]/15 text-[#dda5f4] border-[#bf76e2]/35',
  grass: 'bg-[#5ebd80]/15 text-[#93e2ad] border-[#5ebd80]/35',
  psychic: 'bg-[#dd71b1]/15 text-[#f2a3d1] border-[#dd71b1]/35',
  fighting: 'bg-[#dc8067]/15 text-[#ffb09d] border-[#dc8067]/35',
  flying: 'bg-[#8da7e8]/15 text-[#b9caff] border-[#8da7e8]/35',
  poison: 'bg-[#b56bc7]/15 text-[#e1a2ed] border-[#b56bc7]/35',
  ground: 'bg-[#c99a5c]/15 text-[#f0c98f] border-[#c99a5c]/35',
  rock: 'bg-[#a99969]/15 text-[#d6c78f] border-[#a99969]/35',
  bug: 'bg-[#9abf4d]/15 text-[#c9e67f] border-[#9abf4d]/35',
  steel: 'bg-[#8c9aa9]/15 text-[#c4d0db] border-[#8c9aa9]/35',
  ice: 'bg-[#6fc7d5]/15 text-[#a6edf5] border-[#6fc7d5]/35',
  fairy: 'bg-[#dd91c3]/15 text-[#f5b9df] border-[#dd91c3]/35',
  normal: 'bg-[#b0b5c5]/15 text-[#d9dce4] border-[#b0b5c5]/35',
};

function getPlayerId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('arena-player-id') ?? '';
}
function setPlayerId(id: string) {
  window.localStorage.setItem('arena-player-id', id);
}
function firstType(type: string) { return type.split(' / ')[0]; }

type AttackMove = {
  name: string;
  type: string;
  power: number;
  kind: 'electric' | 'fire' | 'water' | 'ghost' | 'fighting' | 'psychic' | 'grass' | 'dragon' | 'dark' | 'normal' | 'flying' | 'poison' | 'ground' | 'rock' | 'bug' | 'steel' | 'ice' | 'fairy';
  description: string;
};

const MOVE_SETS: Record<string, AttackMove[]> = {
  electric: [
    { name: 'Thunder Shock', type: 'electric', power: 18, kind: 'electric', description: 'A sharp burst of stadium-bright electricity.' },
    { name: 'Electro Ball', type: 'electric', power: 22, kind: 'electric', description: 'A charged orb streaks across the field.' },
    { name: 'Quick Attack', type: 'normal', power: 14, kind: 'normal', description: 'A blur of speed before the rival can react.' },
  ],
  fire: [
    { name: 'Ember', type: 'fire', power: 16, kind: 'fire', description: 'A fan of hot sparks catches the air.' },
    { name: 'Flamethrower', type: 'fire', power: 24, kind: 'fire', description: 'A roaring column of flame crosses the arena.' },
    { name: 'Dragon Claw', type: 'dragon', power: 20, kind: 'dragon', description: 'A glowing slash tears through the spotlight.' },
  ],
  water: [
    { name: 'Water Pulse', type: 'water', power: 19, kind: 'water', description: 'A spiraling wave crashes into the rival.' },
    { name: 'Aqua Jet', type: 'water', power: 17, kind: 'water', description: 'A high-speed ribbon of water surges forward.' },
    { name: 'Ice Beam', type: 'ice', power: 22, kind: 'ice', description: 'A frozen beam cuts through the mist.' },
  ],
  ghost: [
    { name: 'Shadow Ball', type: 'ghost', power: 22, kind: 'ghost', description: 'A haunted pulse warps the air around it.' },
    { name: 'Dark Pulse', type: 'dark', power: 20, kind: 'dark', description: 'A ring of dark energy ripples through the lights.' },
    { name: 'Sludge Bomb', type: 'poison', power: 18, kind: 'poison', description: 'A toxic blast splashes across the arena.' },
  ],
  fighting: [
    { name: 'Aura Sphere', type: 'fighting', power: 22, kind: 'fighting', description: 'A focused sphere of aura finds its mark.' },
    { name: 'Force Palm', type: 'fighting', power: 18, kind: 'fighting', description: 'A close-range shockwave ripples across the floor.' },
    { name: 'Meteor Mash', type: 'steel', power: 24, kind: 'steel', description: 'A heavy metallic strike lands with a flash.' },
  ],
  psychic: [
    { name: 'Psybeam', type: 'psychic', power: 20, kind: 'psychic', description: 'A prismatic beam bends the stadium lights.' },
    { name: 'Psychic', type: 'psychic', power: 23, kind: 'psychic', description: 'The air folds around the opposing Pokémon.' },
    { name: 'Dazzling Gleam', type: 'psychic', power: 18, kind: 'psychic', description: 'A bright wave sweeps across the battlefield.' },
  ],
  grass: [
    { name: 'Leaf Blade', type: 'grass', power: 21, kind: 'grass', description: 'A razor leaf arcs through the spotlight.' },
    { name: 'Energy Ball', type: 'grass', power: 22, kind: 'grass', description: 'A green pulse blooms before impact.' },
    { name: 'Spirit Shackle', type: 'ghost', power: 19, kind: 'ghost', description: 'A shadowy bind pins the rival in place.' },
  ],
  dragon: [
    { name: 'Dragon Claw', type: 'dragon', power: 23, kind: 'dragon', description: 'A neon claw mark slices through the haze.' },
    { name: 'Dragon Pulse', type: 'dragon', power: 24, kind: 'dragon', description: 'A spiraling dragon pulse thunders across the field.' },
    { name: 'Earth Power', type: 'ground', power: 20, kind: 'ground', description: 'The arena floor bucks under a burst of force.' },
  ],
  dark: [
    { name: 'Foul Play', type: 'dark', power: 20, kind: 'dark', description: 'A low shadow rushes beneath the stadium lights.' },
    { name: 'Snarl', type: 'dark', power: 17, kind: 'dark', description: 'A dark shockwave rattles the whole arena.' },
    { name: 'Night Slash', type: 'dark', power: 22, kind: 'dark', description: 'A black crescent flashes across the field.' },
  ],
  normal: [
    { name: 'Body Slam', type: 'normal', power: 18, kind: 'normal', description: 'A clean heavy hit echoes through the stands.' },
    { name: 'Hyper Beam', type: 'normal', power: 27, kind: 'normal', description: 'A blinding beam fires straight down the lane.' },
    { name: 'Rest', type: 'normal', power: 0, kind: 'normal', description: 'A quiet reset restores a little momentum.' },
  ],
  flying: [
    { name: 'Aerial Ace', type: 'flying', power: 21, kind: 'flying', description: 'A clean dive cuts through the stadium air.' },
    { name: 'Air Slash', type: 'flying', power: 23, kind: 'flying', description: 'A sharp crescent of wind slices forward.' },
    { name: 'Quick Attack', type: 'normal', power: 14, kind: 'normal', description: 'A blur of speed before the rival can react.' },
  ],
  poison: [
    { name: 'Poison Jab', type: 'poison', power: 21, kind: 'poison', description: 'A venom-coated strike leaves a toxic sting.' },
    { name: 'Sludge Bomb', type: 'poison', power: 23, kind: 'poison', description: 'A toxic blast splashes across the arena.' },
    { name: 'Venoshock', type: 'poison', power: 19, kind: 'poison', description: 'A pulsing violet wave poisons the air.' },
  ],
  ground: [
    { name: 'Earthquake', type: 'ground', power: 25, kind: 'ground', description: 'The arena floor breaks in a rolling shockwave.' },
    { name: 'Bulldoze', type: 'ground', power: 20, kind: 'ground', description: 'A low tremor races beneath the rival.' },
    { name: 'Rock Tomb', type: 'rock', power: 18, kind: 'rock', description: 'Stone pillars burst up around the target.' },
  ],
  rock: [
    { name: 'Rock Slide', type: 'rock', power: 22, kind: 'rock', description: 'A cascade of stone crashes through the lane.' },
    { name: 'Stone Edge', type: 'rock', power: 25, kind: 'rock', description: 'A jagged shard launches with brutal force.' },
    { name: 'Rock Tomb', type: 'rock', power: 18, kind: 'rock', description: 'Stone pillars burst up around the target.' },
  ],
  bug: [
    { name: 'X-Scissor', type: 'bug', power: 22, kind: 'bug', description: 'Twin arcs of energy snap across the field.' },
    { name: 'Bug Buzz', type: 'bug', power: 21, kind: 'bug', description: 'A vibrating pulse rattles the stadium lights.' },
    { name: 'U-turn', type: 'bug', power: 18, kind: 'bug', description: 'A fast looping strike finds its opening.' },
  ],
  steel: [
    { name: 'Metal Claw', type: 'steel', power: 18, kind: 'steel', description: 'A polished steel swipe flashes at close range.' },
    { name: 'Iron Head', type: 'steel', power: 23, kind: 'steel', description: 'A solid metallic charge crashes into the rival.' },
    { name: 'Meteor Mash', type: 'steel', power: 25, kind: 'steel', description: 'A heavy metallic strike lands with a flash.' },
  ],
  ice: [
    { name: 'Ice Shard', type: 'ice', power: 18, kind: 'ice', description: 'A volley of frozen shards skitters across the field.' },
    { name: 'Ice Beam', type: 'ice', power: 24, kind: 'ice', description: 'A frozen beam cuts through the mist.' },
    { name: 'Avalanche', type: 'ice', power: 22, kind: 'ice', description: 'A wall of ice surges toward the rival.' },
  ],
  fairy: [
    { name: 'Fairy Wind', type: 'fairy', power: 18, kind: 'fairy', description: 'A sparkling gust spirals around the target.' },
    { name: 'Dazzling Gleam', type: 'fairy', power: 23, kind: 'fairy', description: 'A bright wave sweeps across the battlefield.' },
    { name: 'Moonblast', type: 'fairy', power: 25, kind: 'fairy', description: 'A moonlit orb bursts in a shower of stars.' },
  ],
};

function movesFor(pokemon: LocalPokemon) {
  return MOVE_SETS[firstType(pokemon.type)] ?? MOVE_SETS.normal;
}
function cx(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [playerName, setPlayerName] = useState('');
  const players = useListPlayers({ query: { queryKey: getListPlayersQueryKey(), refetchInterval: 5000, refetchOnWindowFocus: true } });
  useEffect(() => {
    const id = getPlayerId();
    const current = players.data?.find((p) => p.id === id);
    if (current) setPlayerName(current.username);
  }, [players.data]);
  return (
    <div className="arena-noise min-h-[100dvh] bg-[#101525] text-[#f7f1de]">
      <header className="sticky top-0 z-40 border-b border-[#30394f] bg-[#101525]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between px-4 sm:px-8">
          <Link href="/" data-testid="link-home" className="flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-[#f7f1de] bg-[#ed5d79] shadow-[0_0_0_4px_#101525,0_0_0_6px_#ed5d79]">
              <span className="h-2 w-2 rounded-full bg-[#f7f1de]" />
            </span>
            <span className="display-font text-[25px] font-extrabold uppercase leading-none tracking-[.04em]">Pokémon <span className="text-[#e7b63f]">Arena</span></span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/" data-testid="link-lobby" className={cx('rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#1d263a]', location === '/' && 'bg-[#1d263a] text-[#53d7a0]')}>Lobby</Link>
            <Link href="/admin" data-testid="link-admin" className={cx('rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#1d263a]', location === '/admin' && 'bg-[#1d263a] text-[#53d7a0]')}>Control room</Link>
          </nav>
          <a href={location === '/' ? '#players' : '/'} data-testid="link-player-picker" className="flex items-center gap-2 rounded-full border border-[#3b4660] bg-[#1a2235] py-1.5 pl-2 pr-3 text-sm hover:border-[#53d7a0]">
            <CircleUserRound className="h-5 w-5 text-[#53d7a0]" />
            <span className="max-w-[120px] truncate">{playerName || 'Choose codename'}</span>
          </a>
        </div>
      </header>
      {children}
      <footer className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-8 text-xs text-[#68748e] sm:px-8">
        <span className="mono-font uppercase tracking-[.18em]">Match night / neighborhood circuit</span>
        <span>Built for quick battles</span>
      </footer>
    </div>
  );
}

function SectionKicker({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'pink' | 'gold' }) {
  return <p className={cx('mono-font mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.22em]', tone === 'mint' ? 'text-[#53d7a0]' : tone === 'pink' ? 'text-[#ed5d79]' : 'text-[#e7b63f')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</p>;
}

function Button({ children, kind = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'pink' }) {
  return <button {...props} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40', kind === 'primary' && 'bg-[#53d7a0] text-[#101525] hover:bg-[#78e4b8]', kind === 'pink' && 'bg-[#ed5d79] text-[#fff5f0] hover:bg-[#f17b92]', kind === 'ghost' && 'border border-[#3b4660] bg-[#1a2235] text-[#dce2ee] hover:border-[#53d7a0] hover:text-[#53d7a0]', className)}>{children}</button>;
}

function StatusPill({ status }: { status: string }) {
  const copy: Record<string, string> = { waiting: 'Open slot', 'team-select': 'Drafting', battle: 'Live battle', complete: 'Complete' };
  return <span data-testid={`status-${status}`} className={cx('mono-font inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[.12em]', status === 'battle' ? 'border-[#ed5d79]/50 bg-[#ed5d79]/15 text-[#ff9caf]' : status === 'waiting' ? 'border-[#e7b63f]/40 bg-[#e7b63f]/10 text-[#f6d46e]' : 'border-[#53d7a0]/40 bg-[#53d7a0]/10 text-[#7be7b8]')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{copy[status] ?? status}</span>;
}

function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const playersQuery = useListPlayers({ query: { queryKey: getListPlayersQueryKey(), refetchInterval: 3000, refetchOnWindowFocus: true } });
  const lobbiesQuery = useListLobbies({ query: { refetchInterval: 3000, refetchOnWindowFocus: true, queryKey: getListLobbiesQueryKey() } });
  const createPlayer = useCreatePlayer();
  const createLobby = useCreateLobby();
  const joinLobby = useJoinLobby();
  const [codename, setCodename] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPlayer, setJoinPlayer] = useState(() => getPlayerId());
  const [notice, setNotice] = useState('');
  const selectedPlayer = playersQuery.data?.find((player) => player.id === joinPlayer);

  useEffect(() => {
    if (joinPlayer && playersQuery.data && !selectedPlayer) {
      setJoinPlayer('');
      window.localStorage.removeItem('arena-player-id');
    }
  }, [joinPlayer, playersQuery.data, selectedPlayer]);

  const createPlayerAndContinue = () => {
    if (codename.trim().length < 2) return setNotice('Use at least 2 characters for your codename.');
    createPlayer.mutate({ data: { username: codename.trim() } }, {
      onSuccess: (player) => { setPlayerId(player.id); setJoinPlayer(player.id); setCodename(''); setNotice(`${player.username} is on the roster.`); queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); },
      onError: () => setNotice('That codename is already in the arena. Try another.'),
    });
  };
  const createRoom = () => {
    const id = joinPlayer || getPlayerId();
    if (!id) return setNotice('Choose a codename before opening a room.');
    createLobby.mutate({ data: { hostPlayerId: id } }, { onSuccess: (lobby) => setLocation(`/team/${lobby.id}`), onError: () => setNotice('Could not open this room. Try again.') });
  };
  const joinRoom = () => {
    const lobby = lobbiesQuery.data?.find((item) => item.code.toLowerCase() === joinCode.trim().toLowerCase());
    if (!lobby) return setNotice('No open room matches that code.');
    if (!joinPlayer) return setNotice('Choose a codename before joining.');
    joinLobby.mutate({ id: lobby.id, data: { playerId: joinPlayer } }, { onSuccess: () => setLocation(`/team/${lobby.id}`), onError: () => setNotice('This room is already full.') });
  };
  const openLobbies = lobbiesQuery.data?.filter((lobby) => lobby.status === 'waiting') ?? [];
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-8">
      <section className="grid min-h-[550px] items-center gap-10 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
        <div className="stagger-in">
          <SectionKicker>Local circuit / season 04</SectionKicker>
          <h1 className="display-font max-w-[650px] text-[clamp(4rem,11vw,8.5rem)] font-black uppercase leading-[.82] tracking-[-.035em]">Pick your<br /><span className="text-[#53d7a0]">seven.</span> Own<br /><span className="text-[#ed5d79]">the night.</span></h1>
          <p className="mt-7 max-w-[510px] text-base leading-7 text-[#aeb7c9] sm:text-lg">A neighborhood Pokémon arena for quick drafts, loud rivalries, and one winner on the other side of the stadium lights.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={createRoom} disabled={createLobby.isPending} data-testid="button-create-room"><Swords className="h-4 w-4" />{createLobby.isPending ? 'Opening...' : 'Create a room'}<ArrowRight className="h-4 w-4" /></Button>
            <a href="#rooms" data-testid="link-find-room" className="inline-flex items-center gap-2 rounded-lg border border-[#3b4660] px-4 py-2.5 text-sm font-bold text-[#dce2ee] hover:border-[#53d7a0] hover:text-[#53d7a0]">Find a room</a>
          </div>
        </div>
        <div className="stagger-in relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-[#53d7a0]/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.4rem] border border-[#4c5970] bg-[#1a2235] p-2 shadow-[0_24px_80px_rgba(3,8,20,.45)]">
            <div className="relative aspect-[1.27] overflow-hidden rounded-[1rem]">
              <img src={HERO_ASSET} alt="Trainers facing off in Lumiose City" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101525]/95 via-transparent to-[#101525]/10" />
              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/20 bg-[#101525]/70 px-3 py-1.5 backdrop-blur-md"><Radio className="h-3 w-3 text-[#ed5d79]" /><span className="mono-font text-[10px] uppercase tracking-[.16em] text-[#fff5f0]">Arena live</span></div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-[#53d7a0]">Tonight's headline</p><p className="display-font mt-1 text-3xl font-bold uppercase">Lumiose after dark</p></div><span className="mono-font text-xs text-[#c2cad7]">04 / 07</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 border-y border-[#30394f] py-7 sm:grid-cols-3">
        {[['01', 'Choose your codename', 'No profiles. Just your name under the lights.'], ['02', 'Draft seven Pokémon', 'Bring a plan, then leave room for a surprise.'], ['03', 'Make the call', 'Every turn is public. Every choice counts.']].map(([number, title, copy]) => <div key={number} className="flex gap-4"><span className="display-font text-3xl font-bold text-[#e7b63f]">{number}</span><div><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-5 text-[#8c97ab]">{copy}</p></div></div>)}
      </section>

      <section className="grid gap-8 py-14 lg:grid-cols-[.8fr_1.2fr]" id="rooms">
        <div>
          <SectionKicker tone="gold">Get on the board</SectionKicker>
          <h2 className="display-font text-5xl font-bold uppercase leading-none sm:text-6xl">Make noise<br />in the <span className="text-[#e7b63f]">stands.</span></h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#8c97ab]">Your codename follows you from the lobby to the final hit. Create a player once, then jump into any open room.</p>
          <div className="mt-7 rounded-2xl border border-[#3b4660] bg-[#171e30] p-5">
            <SectionKicker tone="pink">New to the circuit?</SectionKicker>
             <div id="players" className="mb-4">
               <p className="mb-2 text-xs font-semibold text-[#aeb7c9]">Choose your player</p>
               <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {playersQuery.isLoading && <p className="col-span-full text-xs text-[#8c97ab]">Loading available players...</p>}
                  {playersQuery.isError && <p className="col-span-full text-xs text-[#ff9a88]">The player roster is unavailable. Refresh and try again.</p>}
                  {playersQuery.data?.map((player) => <button type="button" key={player.id} onClick={() => { setJoinPlayer(player.id); setPlayerId(player.id); setNotice(`${player.username} selected.`); }} data-testid={`button-select-player-${player.id}`} className={cx('flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors', joinPlayer === player.id ? 'border-[#53d7a0] bg-[#53d7a0]/15 text-[#f7f1de]' : 'border-[#3b4660] bg-[#101525] text-[#aeb7c9] hover:border-[#53d7a0]')}><span className="truncate">{player.username}</span><span className={cx('h-2 w-2 shrink-0 rounded-full', player.status === 'offline' ? 'bg-[#5a647a]' : player.status === 'battling' ? 'bg-[#ed5d79]' : 'bg-[#53d7a0]')} /></button>)}
               </div>
             </div>
            <div className="flex gap-2"><input value={codename} onChange={(e) => setCodename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPlayerAndContinue()} data-testid="input-codename" placeholder="e.g. nightshift" className="min-w-0 flex-1 rounded-lg border border-[#3b4660] bg-[#101525] px-3 py-2.5 text-sm outline-none placeholder:text-[#65718a] focus:border-[#53d7a0]" /><Button onClick={createPlayerAndContinue} kind="pink" disabled={createPlayer.isPending} data-testid="button-create-player"><UserPlus className="h-4 w-4" />Join</Button></div>
            {notice && <p data-testid="status-home-notice" className="mt-3 text-xs text-[#f6d46e]">{notice}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-end justify-between"><div><SectionKicker>Open rooms</SectionKicker><h3 className="display-font text-3xl font-bold uppercase">Pick a match</h3></div><span className="mono-font text-xs text-[#68748e]">{openLobbies.length.toString().padStart(2, '0')} available</span></div>
          <div className="space-y-3">
            {lobbiesQuery.isLoading && [1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-xl border border-[#30394f] bg-[#171e30]" />)}
            {!lobbiesQuery.isLoading && openLobbies.length === 0 && <div className="rounded-2xl border border-dashed border-[#3b4660] bg-[#171e30] px-6 py-12 text-center"><Target className="mx-auto h-7 w-7 text-[#e7b63f]" /><p className="mt-3 font-bold">No open rooms right now</p><p className="mt-1 text-sm text-[#8c97ab]">Start one and send the code to your rival.</p></div>}
            {openLobbies.map((lobby) => <div key={lobby.id} data-testid={`card-lobby-${lobby.id}`} className="group flex items-center justify-between rounded-xl border border-[#30394f] bg-[#171e30] p-4 transition-colors hover:border-[#53d7a0]/60"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#232d45] text-[#e7b63f]"><Crown className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-bold">{lobby.host.username}</p><p className="mono-font mt-1 text-[10px] uppercase tracking-[.13em] text-[#68748e]">Room {lobby.code}</p></div></div><div className="flex items-center gap-3"><StatusPill status={lobby.status} /><Button kind="ghost" className="px-3 py-2" onClick={() => { if (!joinPlayer) return setNotice('Choose a codename first.'); joinLobby.mutate({ id: lobby.id, data: { playerId: joinPlayer } }, { onSuccess: () => setLocation(`/team/${lobby.id}`), onError: () => setNotice('Could not join this room.') }); }} disabled={joinLobby.isPending} data-testid={`button-join-lobby-${lobby.id}`}><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Join</span></Button></div></div>)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[#30394f] bg-[#171e30] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div><SectionKicker tone="pink">Have an invite?</SectionKicker><h3 className="display-font text-3xl font-bold uppercase">Enter a room code</h3><p className="mt-1 text-sm text-[#8c97ab]">Your rival is already waiting under the floodlights.</p></div>
        <div className="flex gap-2"><input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} data-testid="input-room-code" maxLength={6} placeholder="A7K9Q2" className="w-32 rounded-lg border border-[#3b4660] bg-[#101525] px-3 py-2.5 text-center font-mono text-sm uppercase tracking-[.15em] outline-none focus:border-[#ed5d79]" /><Button kind="pink" onClick={joinRoom} data-testid="button-join-by-code">Enter <ArrowRight className="h-4 w-4" /></Button></div>
      </section>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#68748e]"><Users className="h-3.5 w-3.5" />{playersQuery.data?.length ?? 0} players in the neighborhood circuit</div>
    </main>
  );
}

function PokemonCard({ pokemon, selected, onClick }: { pokemon: LocalPokemon; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} data-testid={`button-pokemon-${pokemon.id}`} className={cx('group relative overflow-hidden rounded-xl border bg-[#171e30] p-3 text-left transition-all hover:-translate-y-1', selected ? 'border-[#53d7a0] bg-[#1d3b3a] shadow-[0_0_0_1px_#53d7a0]' : 'border-[#30394f] hover:border-[#64728f]')}><div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-[#53617a] bg-[#101525] text-[#78849c]">{selected ? <Check className="h-3.5 w-3.5 text-[#53d7a0]" /> : <Plus className="h-3.5 w-3.5" />}</div><div className="flex h-28 items-center justify-center"><img src={pokemon.image} alt={pokemon.name} className={cx('h-24 w-24 object-contain transition-transform group-hover:scale-110', selected && 'float-sprite')} /></div><p className="display-font text-xl font-bold uppercase leading-none">{pokemon.name}</p><span className={cx('mt-2 inline-flex rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[.1em]', typeTone[firstType(pokemon.type)] ?? 'border-[#53617a] text-[#aeb7c9]')}>{pokemon.type}</span></button>;
}

function TeamDraft() {
  const { lobbyId = '' } = useParams<{ lobbyId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const lobbyQuery = useGetLobby(lobbyId, { query: { queryKey: getGetLobbyQueryKey(lobbyId), refetchInterval: 1500, refetchOnWindowFocus: true } });
  const saveTeam = useSaveTeam();
  const startBattle = useStartBattle();
  const [selected, setSelected] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [pokemonSearch, setPokemonSearch] = useState('');
  const playerId = getPlayerId();
  const lobby = lobbyQuery.data;
  const isHost = lobby?.host.id === playerId;
  const myReady = isHost ? lobby?.hostReady : lobby?.guestReady;
  useEffect(() => {
    if (lobby?.status === 'battle') setLocation(`/battle/${lobby.id}`);
  }, [lobby, setLocation]);
  useEffect(() => {
    if (!lobby || !playerId || myReady) return;
    const savedTeam = (isHost ? lobby.hostTeam : lobby.guestTeam) ?? [];
    if (savedTeam.length === 7) {
      setSelected(savedTeam.map((pokemon) => pokemon.id));
      setSaved(true);
    }
  }, [isHost, lobby, myReady, playerId]);
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 7 ? [...current, id] : current);
  const filteredPokemon = useMemo(() => {
    const query = pokemonSearch.trim().toLowerCase();
    return query ? POKEMON.filter((pokemon) => pokemon.name.toLowerCase().includes(query) || pokemon.type.toLowerCase().includes(query)) : POKEMON;
  }, [pokemonSearch]);
  const submit = () => {
    if (selected.length !== 7 || !playerId) return;
    saveTeam.mutate({ id: lobbyId, data: { playerId, pokemonIds: selected } }, { onSuccess: (updated) => { setSaved(true); queryClient.setQueryData(getGetLobbyQueryKey(lobbyId), updated); if (updated.status === 'battle') setLocation(`/battle/${lobbyId}`); } });
  };
  if (lobbyQuery.isLoading) return <LoadingScreen label="Connecting to the draft room" />;
  if (lobbyQuery.isError || !lobby) return <ProblemScreen />;
  return <main className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-8">
    <div className="flex items-center justify-between py-7"><Link href="/" data-testid="link-back-lobby" className="inline-flex items-center gap-1 text-sm text-[#8c97ab] hover:text-[#53d7a0]"><ChevronLeft className="h-4 w-4" />Back to lobby</Link><StatusPill status={lobby.status} /></div>
    <section className="mb-9 flex flex-col justify-between gap-5 border-b border-[#30394f] pb-8 sm:flex-row sm:items-end"><div><SectionKicker>Room {lobby.code} / roster lock</SectionKicker><h1 className="display-font text-6xl font-black uppercase leading-none">Draft your <span className="text-[#53d7a0]">seven.</span></h1><p className="mt-3 text-sm text-[#8c97ab]">Build a squad, then lock it. Your rival can see when you are ready.</p></div><div className="flex items-center gap-2"><div className={cx('rounded-lg border px-3 py-2 text-center', myReady ? 'border-[#53d7a0]/50 bg-[#53d7a0]/10' : 'border-[#3b4660] bg-[#171e30]')}><p className="mono-font text-[9px] uppercase tracking-[.12em] text-[#8893ad]">Your status</p><p className={cx('mt-1 text-sm font-bold', myReady ? 'text-[#53d7a0]' : 'text-[#f6d46e]')}>{myReady ? 'Ready' : 'Choosing'}</p></div><div className="rounded-lg border border-[#3b4660] bg-[#171e30] px-3 py-2 text-center"><p className="mono-font text-[9px] uppercase tracking-[.12em] text-[#8893ad]">Squad</p><p className="mt-1 text-sm font-bold">{selected.length} / 7</p></div></div></section>
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
       <section><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="display-font text-3xl font-bold uppercase">Available roster</h2><p className="mt-1 text-xs text-[#68748e]">{POKEMON.length} Pokémon ready to draft</p></div><input value={pokemonSearch} onChange={(e) => setPokemonSearch(e.target.value)} data-testid="input-pokemon-search" placeholder="Search Pokémon or type" className="w-full rounded-lg border border-[#3b4660] bg-[#101525] px-3 py-2.5 text-sm outline-none placeholder:text-[#65718a] focus:border-[#53d7a0] sm:max-w-64" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{filteredPokemon.map((pokemon) => <PokemonCard key={pokemon.id} pokemon={pokemon} selected={selected.includes(pokemon.id)} onClick={() => toggle(pokemon.id)} />)}</div>{filteredPokemon.length === 0 && <div className="rounded-xl border border-dashed border-[#3b4660] p-8 text-center text-sm text-[#8c97ab]">No Pokémon match that search.</div>}</section>
     <aside className="h-fit rounded-2xl border border-[#3b4660] bg-[#171e30] p-5 lg:sticky lg:top-24"><SectionKicker tone="gold">Match status</SectionKicker><div className="space-y-3"><div className="flex items-center justify-between border-b border-[#30394f] pb-3"><span className="text-sm text-[#8c97ab]">{lobby.host.username}</span><span className={cx('text-xs font-bold', lobby.hostReady ? 'text-[#53d7a0]' : 'text-[#68748e]')}>{lobby.hostReady ? 'READY' : 'PICKING'}</span></div><div className="flex items-center justify-between border-b border-[#30394f] pb-3"><span className="text-sm text-[#8c97ab]">{lobby.guest?.username ?? 'Waiting for rival'}</span><span className={cx('text-xs font-bold', lobby.guestReady ? 'text-[#53d7a0]' : 'text-[#68748e]')}>{lobby.guestReady ? 'READY' : lobby.guest ? 'PICKING' : 'OPEN'}</span></div></div><div className="mt-5 rounded-xl bg-[#101525] p-4 text-sm leading-6 text-[#8c97ab]"><Gauge className="mb-2 h-5 w-5 text-[#e7b63f]" />Exactly seven picks. No duplicates. Once both trainers lock seven, the battle starts automatically.</div><Button onClick={submit} disabled={selected.length !== 7 || saveTeam.isPending || !!myReady} className="mt-5 w-full" data-testid="button-submit-team">{saveTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{myReady ? 'Team locked' : saved ? 'Ready — waiting' : `Lock team (${selected.length}/7)`}</Button>{isHost && lobby.hostReady && lobby.guestReady && <Button kind="pink" onClick={() => startBattle.mutate({ id: lobbyId }, { onSuccess: () => setLocation(`/battle/${lobbyId}`) })} disabled={startBattle.isPending} className="mt-2 w-full" data-testid="button-start-battle"><Swords className="h-4 w-4" />Start battle</Button>}</aside>
    </div>
  </main>;
}

function TeamStrip({ team, side, activeIndex = -1, defeated = [] }: { team: LocalPokemon[]; side: 'left' | 'right'; activeIndex?: number; defeated?: number[] }) {
  return <div className={cx('flex gap-1.5', side === 'right' && 'justify-end')}>{team.slice(0, 7).map((pokemon, index) => <div key={pokemon.id} className={cx('grid h-10 w-10 place-items-center rounded-lg border bg-[#172238] transition-all', index === activeIndex ? 'border-[#f6d46e] shadow-[0_0_0_1px_#f6d46e]' : 'border-[#4a5670]', defeated.includes(index) && 'opacity-35 grayscale')}><img src={pokemon.image} alt={pokemon.name} className="h-8 w-8 object-contain" /></div>)}</div>;
}

function Battle() {
  const { lobbyId = '' } = useParams<{ lobbyId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const lobbyQuery = useGetLobby(lobbyId, { query: { queryKey: getGetLobbyQueryKey(lobbyId), refetchInterval: 1200 } });
  const lobby = lobbyQuery.data;
  const playerId = getPlayerId();
  const publishBattleEvent = usePublishBattleEvent();
  const lastRemoteEvent = useRef('');
  const [log, setLog] = useState(['The stadium lights flare. This one is for the neighborhood.', 'Both trainers send out their lead Pokémon.']);
  const [enemyHp, setEnemyHp] = useState(82);
  const [playerHp, setPlayerHp] = useState(100);
  const [throwing, setThrowing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [defeatedPlayer, setDefeatedPlayer] = useState<number[]>([]);
  const [defeatedEnemy, setDefeatedEnemy] = useState<number[]>([]);
  const [needReplacement, setNeedReplacement] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<'win' | 'loss' | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [attackFx, setAttackFx] = useState<AttackMove | null>(null);
  const [hitPulse, setHitPulse] = useState(false);
  const [damageNumber, setDamageNumber] = useState<number | null>(null);
  const [attackLocked, setAttackLocked] = useState(false);
  const defeatedPlayerRef = useRef<number[]>([]);
  const defeatedEnemyRef = useRef<number[]>([]);
  const isHost = lobby?.host.id === playerId;
  const isGuest = lobby?.guest?.id === playerId;
  const isMyTurn = Boolean(lobby && playerId && (lobby.battleTurn % 2 === 0 ? isHost : isGuest));
  const turn = (lobby?.battleTurn ?? 0) + 1;
  const playerTeam = useMemo(() => (isHost ? lobby?.hostTeam : lobby?.guestTeam)?.length ? (isHost ? lobby?.hostTeam : lobby?.guestTeam) ?? [] : POKEMON.slice(0, 7), [isHost, lobby]);
  const enemyTeam = useMemo(() => (isHost ? lobby?.guestTeam : lobby?.hostTeam)?.length ? (isHost ? lobby?.guestTeam : lobby?.hostTeam) ?? [] : POKEMON.slice(5, 12), [isHost, lobby]);
  const player = playerTeam[activeIndex] ?? POKEMON[0];
  const enemy = enemyTeam[enemyIndex] ?? POKEMON[5];
  const moves = useMemo(() => movesFor(player), [player]);
  const markPlayerDefeated = (index: number) => {
    if (defeatedPlayerRef.current.includes(index)) return false;
    const next = [...defeatedPlayerRef.current, index];
    defeatedPlayerRef.current = next;
    setDefeatedPlayer(next);
    if (next.length >= TEAM_SIZE) {
      setNeedReplacement(false);
      setBattleOutcome('loss');
      setLog((items) => ['Your whole team is defeated. The rival wins this match.', ...items]);
    } else {
      setNeedReplacement(true);
      setLog((items) => [`${player.name} is defeated! Choose your next Pokémon.`, ...items]);
    }
    return true;
  };
  const markEnemyDefeated = (index: number) => {
    if (defeatedEnemyRef.current.includes(index)) return false;
    const next = [...defeatedEnemyRef.current, index];
    defeatedEnemyRef.current = next;
    setDefeatedEnemy(next);
    if (next.length >= TEAM_SIZE) {
      setBattleOutcome('win');
      setLog((items) => ['All rival Pokémon are defeated. You win the battle!', ...items]);
    }
    return true;
  };
  useEffect(() => {
    const event = lobby?.battleEvent;
    if (!event || event.playerId === playerId || event.eventId === lastRemoteEvent.current) return;
    lastRemoteEvent.current = event.eventId;
    const remoteMove: AttackMove = {
      name: event.moveName,
      type: event.moveType,
      power: event.movePower,
      kind: event.moveKind as AttackMove['kind'],
      description: event.moveDescription,
    };
    setAttackFx(remoteMove);
    setDamageNumber(remoteMove.power || null);
    setHitPulse(true);
    setLog((items) => [`${enemy.name} used ${remoteMove.name}! ${remoteMove.description}`, ...items]);
    if (remoteMove.power) {
      const nextPlayerHp = Math.max(0, playerHp - remoteMove.power);
      setPlayerHp(nextPlayerHp);
      if (nextPlayerHp === 0) {
        markPlayerDefeated(activeIndex);
      }
    }
    window.setTimeout(() => {
      setAttackFx(null);
      setDamageNumber(null);
      setHitPulse(false);
    }, 900);
  }, [activeIndex, enemy.name, lobby?.battleEvent, player, playerId, playerHp]);
  const sendOut = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    setPlayerHp(100);
    setNeedReplacement(false);
    setLog((items) => [`Go, ${playerTeam[nextIndex]?.name ?? 'new partner'}!`, ...items]);
  };
  const useMove = (move: AttackMove) => {
    if (attackLocked || needReplacement || battleOutcome || playerHp <= 0 || !isMyTurn || !playerId) return;
    setAttackLocked(true);
    setMoveMenuOpen(false);
    publishBattleEvent.mutate({
      id: lobbyId,
      data: {
        playerId,
        moveName: move.name,
        moveType: move.type,
        moveKind: move.kind,
        movePower: move.power,
        moveDescription: move.description,
      },
    }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetLobbyQueryKey(lobbyId), updated);
        setAttackFx(move);
        setDamageNumber(move.power || null);
        setLog((items) => [move.power ? `${player.name} used ${move.name}! ${move.description}` : `${player.name} used ${move.name} and recovered.`, ...items]);
        if (move.power) {
          setTimeout(() => {
            const nextEnemyHp = Math.max(0, enemyHp - move.power);
            setEnemyHp(nextEnemyHp);
            setHitPulse(true);
            setTimeout(() => setHitPulse(false), 420);
            if (nextEnemyHp === 0) {
              const newlyDefeated = markEnemyDefeated(enemyIndex);
              if (!newlyDefeated) return;
              const nextEnemyIndex = enemyIndex + 1;
              if (nextEnemyIndex < enemyTeam.length && defeatedEnemyRef.current.length < TEAM_SIZE) {
                setLog((items) => [`${enemy.name} is defeated! Send out the next Pokémon.`, ...items]);
                setTimeout(() => {
                  setEnemyIndex(nextEnemyIndex);
                  setEnemyHp(100);
                  setLog((items) => [`Rival sent out ${enemyTeam[nextEnemyIndex]?.name ?? 'a new Pokémon'}.`, ...items]);
                }, 500);
              }
            }
          }, 380);
        } else {
          setPlayerHp((hp) => Math.min(100, hp + 12));
        }
        setTimeout(() => {
          setAttackFx(null);
          setDamageNumber(null);
          setAttackLocked(false);
        }, 900);
      },
      onError: () => {
        setAttackLocked(false);
        setLog((items) => ['That action was rejected. Wait for your turn before attacking.', ...items]);
      },
    });
  };
  const act = (action: string) => {
    if (needReplacement || battleOutcome || !isMyTurn || !playerId) return;
    publishBattleEvent.mutate({
      id: lobbyId,
      data: {
        playerId,
        moveName: action,
        moveType: 'normal',
        moveKind: 'normal',
        movePower: 0,
        moveDescription: action === 'Guard' ? 'The trainer braces for the next exchange.' : `${action} used up the turn.`,
      },
    }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetLobbyQueryKey(lobbyId), updated);
        if (action === 'Throw ball') {
          setThrowing(true);
          window.setTimeout(() => setThrowing(false), 850);
        }
        if (action === 'Switch') {
          const nextIndex = playerTeam.findIndex((_, index) => index !== activeIndex && !defeatedPlayer.includes(index));
          if (nextIndex >= 0) sendOut(nextIndex);
        }
        if (action === 'Guard') {
          setPlayerHp((hp) => Math.min(100, hp + 4));
          setLog((items) => ['Guard up. The next hit will not find its mark.', ...items]);
        }
      },
      onError: () => setLog((items) => ['That action was rejected. Wait for your turn.', ...items]),
    });
  };
  if (lobbyQuery.isLoading) return <LoadingScreen label="Tuning the stadium lights" />;
  if (!lobby) return <ProblemScreen />;
  return <main className="mx-auto max-w-[1500px] px-3 pb-8 sm:px-6">
    <div className="flex items-center justify-between py-5"><Link href={`/team/${lobbyId}`} data-testid="link-back-draft" className="inline-flex items-center gap-1 text-sm text-[#aeb7c9] hover:text-[#53d7a0]"><ChevronLeft className="h-4 w-4" />Draft room</Link><div className="flex items-center gap-3"><span className="mono-font text-[10px] uppercase tracking-[.15em] text-[#68748e]">Turn {turn.toString().padStart(2, '0')}</span><StatusPill status="battle" /></div></div>
    <section className="relative min-h-[590px] overflow-hidden rounded-[1.5rem] border border-[#4a5670] bg-[#172238] shadow-[0_25px_70px_rgba(0,0,0,.3)]">
      <img src={BATTLE_ASSET} alt="Stadium battle field" className="absolute inset-0 h-full w-full object-cover opacity-70" /><div className="absolute inset-0 bg-gradient-to-b from-[#111629]/40 via-transparent to-[#111629]/90" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,21,37,.7),transparent_35%,transparent_65%,rgba(16,21,37,.7))]" />
      <div className="relative flex min-h-[590px] flex-col justify-between p-4 sm:p-8">
         <div className="grid grid-cols-2 gap-5"><div><div className="mb-2 flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#53d7a0] text-[#101525]"><Crown className="h-4 w-4" /></div><div><p className="font-bold">{lobby.host.username}</p><div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-[#283249]"><div className="h-full w-[92%] rounded-full bg-[#53d7a0]" /></div></div></div><TeamStrip team={playerTeam} side="left" activeIndex={activeIndex} defeated={defeatedPlayer} /></div><div className="text-right"><div className="mb-2 flex flex-row-reverse items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#ed5d79] text-[#fff5f0]"><Crosshair className="h-4 w-4" /></div><div><p className="font-bold">{lobby.guest?.username ?? 'Rival trainer'}</p><div className="mt-1 ml-auto h-1.5 w-36 overflow-hidden rounded-full bg-[#283249]"><div className="h-full w-[82%] rounded-full bg-[#ed5d79]" /></div></div></div><TeamStrip team={enemyTeam} side="right" activeIndex={enemyIndex} defeated={defeatedEnemy} /></div></div>
         <div className="relative flex flex-1 items-center justify-between px-3 pt-8 sm:px-20"><div className="absolute left-[35%] top-[40%] h-24 w-24 rounded-full border border-[#53d7a0]/40 pulse-ring" /><div className="absolute right-[31%] top-[28%] h-20 w-20 rounded-full border border-[#ed5d79]/40 pulse-ring" />{attackFx && <div className={cx('attack-projectile', `attack-projectile-${attackFx.kind}`)} aria-label={`${attackFx.name} attack animation`}><span /><span /><span /></div>}{damageNumber && <div className="damage-number">-{damageNumber}</div>}{attackFx && <div className="attack-callout"><span className="mono-font">{attackFx.type}</span><strong>{attackFx.name}</strong></div>}{needReplacement && <div className="replacement-panel"><span className="mono-font text-[9px] uppercase tracking-[.15em] text-[#ed5d79]">Pokémon defeated</span><strong>{player.name} needs backup</strong><div className="grid grid-cols-2 gap-2">{playerTeam.map((pokemon, index) => <button type="button" key={pokemon.id} disabled={defeatedPlayer.includes(index)} onClick={() => sendOut(index)} className="replacement-button" data-testid={`button-send-out-${pokemon.id}`}><img src={pokemon.image} alt="" /><span>{pokemon.name}</span></button>)}</div></div>}{battleOutcome && <div className={cx('battle-outcome', battleOutcome === 'win' ? 'battle-outcome-win' : 'battle-outcome-loss')}><span className="mono-font">Match complete</span><strong>{battleOutcome === 'win' ? 'You win the battle.' : 'Rival wins this match.'}</strong><button type="button" onClick={() => setLocation('/')} data-testid="button-return-after-battle">Return to lobby</button></div>}<div className={cx('relative z-10 w-[44%] max-w-[270px]', throwing && 'throw-ball', !!attackFx && 'attack-source')}><div className="absolute -bottom-1 left-1/2 h-5 w-32 -translate-x-1/2 rounded-[50%] bg-[#101525]/70 blur-md" /><img src={player.image} alt={player.name} className="float-sprite relative w-full object-contain drop-shadow-[0_22px_12px_rgba(0,0,0,.45)]" /><div className="absolute -bottom-8 left-0 rounded-lg border border-[#53d7a0]/50 bg-[#101525]/80 px-3 py-1.5 backdrop-blur"><p className="display-font text-2xl font-bold uppercase">{player.name}</p><p className="mono-font text-[9px] uppercase tracking-[.13em] text-[#53d7a0]">{player.type}</p></div></div><div className={cx('relative z-10 w-[44%] max-w-[270px]', hitPulse && 'hit-shake')}><div className="absolute -bottom-1 left-1/2 h-5 w-32 rounded-[50%] bg-[#101525]/70 blur-md" /><img src={enemy.image} alt={enemy.name} className="float-sprite relative w-full object-contain drop-shadow-[0_22px_12px_rgba(0,0,0,.45)] [transform:scaleX(-1)]" /><div className="absolute -bottom-8 right-0 rounded-lg border border-[#ed5d79]/50 bg-[#101525]/80 px-3 py-1.5 text-right backdrop-blur"><p className="display-font text-2xl font-bold uppercase">{enemy.name}</p><p className="mono-font text-[9px] uppercase tracking-[.13em] text-[#ed5d79]">{enemy.type}</p></div></div></div>
         <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-end"><div className="rounded-xl border border-white/15 bg-[#101525]/75 p-4 backdrop-blur-md"><div className="mb-3 flex items-center justify-between"><p className="mono-font text-[10px] uppercase tracking-[.15em] text-[#53d7a0]">Battle log</p><span className="text-[10px] text-[#68748e]">live</span></div><div className="scroll-thin flex max-h-16 flex-col gap-1 overflow-y-auto text-xs text-[#c3cad7]">{log.slice(0, 4).map((line, i) => <p key={`${line}-${i}`} data-testid={`text-battle-log-${i}`}><span className="mr-2 text-[#68748e]">›</span>{line}</p>)}</div></div><div className="relative"><div className="grid grid-cols-4 gap-2">{[[`Attack${moveMenuOpen ? ' open' : ''}`, Zap], ['Guard', Gauge], ['Switch', RefreshCw], ['Throw ball', Target]].map(([label, Icon]) => <button type="button" key={label as string} onClick={() => label?.toString().startsWith('Attack') ? setMoveMenuOpen((open) => !open) : act(label as string)} disabled={attackLocked && label?.toString().startsWith('Attack')} data-testid={`button-action-${(label as string).toLowerCase().replace(' ', '-')}`} className="group rounded-xl border border-white/15 bg-[#101525]/80 px-2 py-3 text-center backdrop-blur-md transition-colors hover:border-[#53d7a0] disabled:opacity-50"><span className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-[#27344e] text-[#53d7a0] group-hover:bg-[#53d7a0] group-hover:text-[#101525]"><Icon className="h-4 w-4" /></span><span className="mt-2 block text-[10px] font-bold text-[#e5e9f0]">{label as string}</span></button>)}</div>{moveMenuOpen && <div className="move-menu"><div className="mb-2 flex items-center justify-between"><span className="mono-font text-[9px] uppercase tracking-[.14em] text-[#53d7a0]">Choose a move</span><span className="text-[10px] text-[#68748e]">{player.name}</span></div>{moves.map((move) => <button type="button" key={move.name} onClick={() => useMove(move)} disabled={attackLocked} className="move-option" data-testid={`button-move-${move.name.toLowerCase().replaceAll(' ', '-')}`}><span className={cx('move-type', `move-type-${move.kind}`)}>{move.type}</span><span className="min-w-0 flex-1 text-left"><strong>{move.name}</strong><small>{move.description}</small></span><span className="mono-font text-xs text-[#f6d46e]">{move.power ? `${move.power} PWR` : 'HEAL'}</span></button>)}</div>}</div></div>
      </div>
    </section>
    <div className="mt-4 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-[#30394f] bg-[#171e30] p-4"><p className="mono-font text-[10px] uppercase tracking-[.15em] text-[#68748e]">Your active HP</p><div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#30394f]"><div className="h-full rounded-full bg-[#53d7a0] transition-all" style={{ width: `${playerHp}%` }} /></div><span className="mono-font text-xs">{playerHp}%</span></div></div><div className="rounded-xl border border-[#30394f] bg-[#171e30] p-4"><p className="mono-font text-[10px] uppercase tracking-[.15em] text-[#68748e]">Rival HP</p><div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#30394f]"><div className="h-full rounded-full bg-[#ed5d79] transition-all" style={{ width: `${enemyHp}%` }} /></div><span className="mono-font text-xs">{enemyHp}%</span></div></div><div className="flex items-center justify-between rounded-xl border border-[#30394f] bg-[#171e30] p-4"><span className="text-sm text-[#8c97ab]">Need a new matchup?</span><Button kind="ghost" onClick={() => setLocation('/')} data-testid="button-leave-battle">Leave battle</Button></div></div>
  </main>;
}

function Admin() {
  const queryClient = useQueryClient();
  const playersQuery = useListPlayers();
  const lobbiesQuery = useListLobbies({ query: { queryKey: getListLobbiesQueryKey(), refetchInterval: 5000 } });
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 8000 } });
  const createPlayer = useCreatePlayer();
  const deletePlayer = useDeletePlayer();
  const [username, setUsername] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const summary = summaryQuery.data;
  const addPlayer = () => { if (username.trim().length < 2) return setAdminNotice('Enter a longer codename.'); createPlayer.mutate({ data: { username: username.trim() } }, { onSuccess: () => { setUsername(''); setAdminNotice('Player added to the roster.'); queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); }, onError: () => setAdminNotice('Could not add that player.') }); };
  return <main className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-8">
    <section className="flex flex-col justify-between gap-6 border-b border-[#30394f] py-10 sm:flex-row sm:items-end"><div><SectionKicker tone="gold">Control room / season 04</SectionKicker><h1 className="display-font text-6xl font-black uppercase leading-none">Keep the<br /><span className="text-[#ed5d79]">circuit</span> moving.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#8c97ab]">Roster management, room health, and the pulse of match night.</p></div><div className="mono-font flex items-center gap-2 text-xs uppercase tracking-[.12em] text-[#53d7a0]"><Radio className="h-4 w-4" /> System online</div></section>
    <section className="grid gap-3 py-8 sm:grid-cols-2 lg:grid-cols-4">{[
      { label: 'Players', value: summary?.totalPlayers ?? 0, icon: Users, hint: 'all-time roster' },
      { label: 'Live rooms', value: summary?.activeLobbies ?? 0, icon: Radio, hint: 'currently open' },
      { label: 'Battles today', value: summary?.battlesToday ?? 0, icon: Swords, hint: 'match history' },
      { label: 'Ready teams', value: summary?.readyTeams ?? 0, icon: Check, hint: 'waiting to launch' },
    ].map(({ label, value, icon: MetricIcon, hint }) => <div key={label} data-testid={`metric-${label.toLowerCase().replace(' ', '-')}`} className="rounded-xl border border-[#30394f] bg-[#171e30] p-5"><div className="flex items-center justify-between"><span className="mono-font text-[10px] uppercase tracking-[.15em] text-[#68748e]">{label}</span><MetricIcon className="h-4 w-4 text-[#e7b63f]" /></div><p className="display-font mt-3 text-5xl font-bold">{value}</p><p className="mt-1 text-xs text-[#8c97ab]">{hint}</p></div>)}</section>
    <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section><div className="mb-4 flex items-end justify-between"><div><SectionKicker>Roster desk</SectionKicker><h2 className="display-font text-3xl font-bold uppercase">Players</h2></div><span className="text-xs text-[#68748e]">{playersQuery.data?.length ?? 0} names</span></div><div className="rounded-xl border border-[#30394f] bg-[#171e30]"><div className="flex gap-2 border-b border-[#30394f] p-4"><input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} data-testid="input-admin-username" placeholder="New codename" className="min-w-0 flex-1 rounded-lg border border-[#3b4660] bg-[#101525] px-3 py-2.5 text-sm outline-none placeholder:text-[#65718a] focus:border-[#53d7a0]" /><Button onClick={addPlayer} disabled={createPlayer.isPending} data-testid="button-admin-add-player"><Plus className="h-4 w-4" />Add player</Button></div>{adminNotice && <p data-testid="status-admin-notice" className="px-4 pt-3 text-xs text-[#f6d46e]">{adminNotice}</p>}<div className="divide-y divide-[#30394f]">{playersQuery.isLoading && <div className="p-5 text-sm text-[#8c97ab]">Loading roster...</div>}{playersQuery.data?.map((player) => <div key={player.id} data-testid={`row-player-${player.id}`} className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><div className={cx('h-2.5 w-2.5 rounded-full', player.status === 'offline' ? 'bg-[#5a647a]' : player.status === 'battling' ? 'bg-[#ed5d79]' : 'bg-[#53d7a0]')} /><div><p className="text-sm font-bold">{player.username}</p><p className="mono-font mt-0.5 text-[10px] uppercase tracking-[.1em] text-[#68748e]">{player.wins}W — {player.losses}L · {player.status}</p></div></div><button type="button" onClick={() => { if (window.confirm(`Remove ${player.username} from the roster?`)) deletePlayer.mutate({ id: player.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }) }); }} data-testid={`button-delete-player-${player.id}`} className="rounded-lg p-2 text-[#68748e] hover:bg-[#ed5d79]/10 hover:text-[#ed5d79]"><Trash2 className="h-4 w-4" /></button></div>)}</div></div></section><section><div className="mb-4"><SectionKicker tone="pink">Room monitor</SectionKicker><h2 className="display-font text-3xl font-bold uppercase">Tonight's rooms</h2></div><div className="space-y-3">{lobbiesQuery.data?.length ? lobbiesQuery.data.map((lobby) => <div key={lobby.id} className="rounded-xl border border-[#30394f] bg-[#171e30] p-4"><div className="flex items-center justify-between"><span className="mono-font text-xs font-bold tracking-[.14em] text-[#e7b63f]">{lobby.code}</span><StatusPill status={lobby.status} /></div><div className="mt-4 flex items-center justify-between text-sm"><span>{lobby.host.username}</span><span className="text-[#68748e]">vs</span><span>{lobby.guest?.username ?? 'Open slot'}</span></div><div className="mt-3 flex gap-1">{Array.from({ length: 7 }).map((_, i) => <div key={i} className={cx('h-1.5 flex-1 rounded-full', i < (lobby.hostTeam?.length ?? 0) ? 'bg-[#53d7a0]' : 'bg-[#30394f]')} />)}</div></div>) : <div className="rounded-xl border border-dashed border-[#3b4660] p-10 text-center text-sm text-[#8c97ab]">No rooms on the board yet.</div>}</div></section></div>
  </main>;
}

function LoadingScreen({ label }: { label: string }) { return <main className="grid min-h-[70dvh] place-items-center px-4"><div className="text-center"><div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full border-2 border-[#53d7a0] shadow-[0_0_0_8px_rgba(83,215,160,.1)]" /><p className="mono-font text-xs uppercase tracking-[.16em] text-[#8c97ab]">{label}</p></div></main>; }
function ProblemScreen() { return <main className="grid min-h-[70dvh] place-items-center px-4"><div className="max-w-sm text-center"><Crosshair className="mx-auto h-9 w-9 text-[#ed5d79]" /><h1 className="display-font mt-4 text-4xl font-bold uppercase">Room signal lost</h1><p className="mt-2 text-sm text-[#8c97ab]">This room may have closed. Return to the lobby and pick another match.</p><Link href="/" data-testid="link-problem-home" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#53d7a0] px-4 py-2.5 text-sm font-bold text-[#101525]">Return to lobby <ArrowRight className="h-4 w-4" /></Link></div></main>; }

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/team/:lobbyId" component={TeamDraft} /><Route path="/battle/:lobbyId" component={Battle} /><Route path="/admin" component={Admin} /><Route component={ProblemScreen} /></Switch>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Shell><Router /></Shell></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;