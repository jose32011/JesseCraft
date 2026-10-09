# Voxland

Voxland is a small, original voxel sandbox built on the assets and ideas already in this repository. It is **not** Minecraft and does not use Minecraft branding or proprietary Minecraft content.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). To play from a phone on the same Wi-Fi, open that URL using the computer's LAN IP address. The standalone Node.js WebSocket server listens on port `3001`.

To build and run both JesseCraft and the Jesse Arcade together:

```sh
npm ci
npm ci --prefix JesseArcade
npm run build:arcade
npm start
```

The arcade is served on port `3000` by default. JesseCraft is available from its **JesseCraft** menu card, and its multiplayer WebSocket shares the arcade server. Set `PORT` to change the listen port. The original standalone JesseCraft server remains available with `node server/index.js`.

The **Voyager server admin** link opens the password-protected web dashboard at `/admin/`. To set its initial password, edit `/root/JesseCraft/.env` on the VPS (`sudo nano /root/JesseCraft/.env`), add `VOYAGER_ADMIN_PASSWORD=REPLACE_WITH_YOUR_OWN_SECRET`, replace the placeholder with a unique private password of at least 8 characters, then run `sudo chmod 600 /root/JesseCraft/.env` and `sudo systemctl restart voxland`. This variable is only used by the dashboard; it does not change or authenticate your VPS/Linux account, SSH credentials, or GitHub deployment credentials. Longer passwords are safer; never reuse your VPS login password or commit the dashboard password. Once signed in, use **Change dashboard password** to set a new password; it is stored as a salted scrypt hash at `/var/lib/voxland/admin/password.json` with owner-only file permissions and takes precedence over the environment bootstrap password. Changing it also disables bootstrap-password fallback, so if the saved hash is lost, restore it from backup or reset the dashboard credentials on the server. The change persists across deployments and signs out other dashboard sessions. The dashboard graphs host CPU, memory, network, and disk throughput, reports the shared Jesse Arcade/JesseCraft process and game activity, and can request a restart of `voxland.service`.

## Saved-world persistence

Without a database, saved worlds are stored as JSON files in `.data/saves`. For local Postgres development, install Docker Compose, then start the database and game:

```sh
cp .env.example .env
npm run db:up
npm run dev
```

The Compose service creates a local `voxland` database and keeps its data in a named volume. The server creates `voxland_worlds` and `voxland_profiles` automatically when it connects. Stop Postgres with `npm run db:down`; this preserves the database volume. To permanently delete local database data, run `docker compose down -v`.

The default `.env.example` credentials are for local development only. For Railway, add a `DATABASE_URL` variable to the game server service. When both services are in the same Railway project and environment, reference the Postgres service's private URL, for example `${{Postgres.DATABASE_URL}}` (replace `Postgres` with the exact service name). Keep production connection URLs private and out of source control. Started worlds autosave every minute by default; players can toggle autosave in the world menu or save immediately with **Save world**. Player profiles, character colors, and profile statistics are keyed by a browser-generated profile ID and stored in Postgres.

### Deploy on a VPS with Nginx

The supplied Nginx and systemd configurations are in `deploy/`. On a Debian/Ubuntu VPS with this repository and its `.env` file installed, build the client and install the service and site configurations:

```sh
npm ci
npm ci --prefix JesseArcade
npm run build:arcade
sudo mkdir -p /opt/voxland/releases
sudo ln -s /root/JesseCraft /opt/voxland/current
sudo cp deploy/voxland.service /etc/systemd/system/voxland.service
sudo cp deploy/voxland.nginx.conf /etc/nginx/sites-available/voxland
sudo ln -s /etc/nginx/sites-available/voxland /etc/nginx/sites-enabled/voxland
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now voxland nginx
```

Allow inbound TCP ports 80 and 443 in the VPS provider firewall, then enable HTTPS for the hostname:

```sh
sudo certbot --nginx -d natalie-khe9ca.cloudserver.nz
```

The game server listens only on localhost behind Nginx, including its WebSocket endpoint. PostgreSQL remains bound to localhost and must not be opened to the public internet.

Socket.IO (the arcade games) also upgrades connections through `/`, so the HTTPS Nginx server block must forward WebSocket upgrade headers there. If the arcade works but the browser console reports a failed `/socket.io/` WebSocket connection, update `/etc/nginx/sites-available/voxland`: add the `map $http_upgrade $connection_upgrade { default upgrade; '' close; }` block at the file's top level, and add `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection $connection_upgrade;` inside the HTTPS server's `location /` block. Keep the existing Certbot HTTPS configuration. Then run `sudo nginx -t && sudo systemctl reload nginx`. The repository's `deploy/voxland.nginx.conf` contains these settings for fresh Nginx installs; automatic app deployments do not overwrite the live Certbot-managed Nginx configuration.

### Deploy automatically from GitHub

The GitHub Actions workflow tests and builds both games for every push to `main`, then uploads an isolated release to the VPS over SSH, switches releases, and restarts the combined arcade. It rolls back to the previous release if the service does not become healthy. To enable it:

1. On your PC, create a dedicated SSH key pair with `ssh-keygen -t ed25519 -C voxland-github-deploy -f ~/.ssh/voxland_deploy`. Add the **public** key (`voxland_deploy.pub`) to the VPS account's `~/.ssh/authorized_keys`. Keep the private key secure.
2. In GitHub, open **Settings → Secrets and variables → Actions** for this repository and add `VPS_HOST` (`natalie-khe9ca.cloudserver.nz`), `VPS_USER` (your VPS SSH account, currently `root`), and `VPS_SSH_KEY` (the complete private key).
3. Pin the VPS SSH host key as the `VPS_KNOWN_HOSTS` secret. Get the host key with `ssh-keyscan -H natalie-khe9ca.cloudserver.nz` and verify its fingerprint against `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the VPS before saving the scan output. This avoids trusting an unverified host key in the deployment workflow.
4. Prepare the release directory and switch the service to the deployment symlink once (skip the first two commands if already done in the VPS setup above):

   ```sh
   sudo mkdir -p /opt/voxland/releases
   sudo ln -s /root/JesseCraft /opt/voxland/current
   sudo cp deploy/voxland.service /etc/systemd/system/voxland.service
   sudo systemctl daemon-reload
   sudo systemctl restart voxland
   ```

   If `/opt/voxland/current` already exists, keep it and verify it points to the currently running release before restarting.
5. Push to `main` from your PC (`git push origin main`). GitHub Actions will deploy automatically after tests and the production build pass. You can follow progress in the repository's **Actions** tab.

The deploy key grants access to the VPS account in `VPS_USER`; use a dedicated account/key where possible and never put the private key in the repository.

## Controls

- Desktop: `W`/`A`/`S`/`D` to move, `Space` to jump, `F` or **Punch** to attack, `G` or the **Fly** button to toggle flight, and hold `Space`/`Shift` or `Page Up`/`Page Down` to rise/descend while flying or piloting a plane. While flying a plane or jet, aim and press `F` to fire at players or monsters. When driving a tank, hold `Z`/`C` to turn the turret and press `F` to fire. Drag the view to look, and point with the mouse crosshair to break or place blocks (left-click/right-click). Your character is shown by default; toggle **Show my character** in World settings to change camera view.
- Mobile: use the on-screen joystick to move, drag the view to look, and use **Jump**, **Break**, and **Place**.
- Controller: connect a standard Gamepad API-compatible controller. The left stick moves (and navigates open menus), right stick aims from the centered crosshair, A jumps or (while flying) rises and activates the focused menu control, B attacks or (while flying) descends, X interacts, Y toggles flight, triggers break/place at the crosshair (or climb/descend in a plane; the right trigger fires a tank cannon), bumpers cycle hotbar items, Back opens inventory, and Start opens settings. D-pad navigates open panels; use left/right to change focused selections.
- In water, hold `Space` to rise or `Shift` to dive; touch players can use the **Rise** and **Dive** buttons that appear in the water.
- Use `E` near a parked car, plane, fighter jet, tank, or boat (or tap the vehicle button on touch) to enter; press `E` again to exit. Cars, tanks, and jets come in varied paint schemes; more tanks are stationed around the city, while fighter jets are parked at the airport. Drive with `W`/`S`, steer with `A`/`D`, and use `Space`/`Shift` or `Page Up`/`Page Down` to climb or descend in a plane or jet. Boats sail over water with `W`/`S` and `A`/`D`; land at an island's shore to explore. Touch players get dedicated **Up** and **Down** flight buttons while flying or piloting. In a tank, use the mobile **Aim** and **Fire** buttons, or hold `Z`/`C` and press `F` on desktop; the camera moves behind the tank so you can see the turret direction. Cannon hits have a cooldown.
- Glass City buildings include floors, stair runs, windows, and walk-through doors. Open the Village Market near a building entrance to buy an available residence; use **Go to my home** or a home's **Go home** button to return there. Ownership is saved with the world.
- Select a block from the hotbar or use number keys `1`–`9`. `Q` breaks and `E` places when not beside a vehicle.
- Press `I` or tap **Bag** to open inventory. Mining collects blocks, dropped items can be picked up by walking close, and inventory rows let you drop items.
- Item counts beyond 64 are split into separate 64-item stacks in the bag.
- Drag an inventory item onto a hotbar slot to assign it. On touch screens, tap the inventory item, then tap a hotbar slot.
- Craft planks from logs, glass from sand and stone, and campfires from logs and stone. Crafted/placeable blocks appear in the hotbar with their inventory counts.
- New players start with 100 coins; defeating monsters awards 50 XP and 25 more coins. Open **World settings → Village market** anywhere to browse 1,000 procedural models, 40 supplied Block Bits models, 78 imported mod assets, and three Kenney blasters across furniture, plants, animals, monsters, dragons, armor, weapons, tools, crystals, and decor. Market entries include lazy-loaded 3D previews; imported assets appear first and can be isolated with the **Imported assets** filter. Buy or add a model, equip it from your inventory to the hotbar, and place it in your world. The Kenney blasters and imported medieval weapons appear in your hand when equipped.
- Design mode starts with 20,000 coins and 64 of every block and catalogue model unlocked. Existing Design-mode saves receive the same full inventory when players rejoin.
- Delete an inactive saved world from the Saved Games list with its **Delete** button. Sign in at `/admin/` first; deletion is permanent and requires confirmation. Worlds with players still in them must be left before they can be deleted.
- Visit the glass-windowed **Boat Workshop** at the harbor pier and choose a skiff, cutter, or galleon, hull and sail colors, cabin, and window count. The workshop can be opened from anywhere around the boathouse and its entrance pier. In Survival, building costs 12/24/40 oak planks by hull size, plus one glass per cabin window and one oak door; Design mode builds for free. Launched boats are saved with the world and can be steered across the open seas to the islands.
- The harbor has a Kenney Pirate Kit ship and rowboat (CC0). New building, terrain, wood, and water textures from PixelTexturePack are applied to matching block materials; city brick and paving also use downloaded ambientCG textures.
- Open **World settings → Open map** and choose **Expand map** for a full-screen view. Select a location marker, then use **Teleport** to travel there.

## Asset credits

- PixelTexturePack textures by Jestan, used under Jestan's Public License for Using This Product; attribution requested.
- Bricks060 and PavingStones036 base-color textures by ambientCG, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): [Bricks060](https://ambientcg.com/a/Bricks060) and [PavingStones036](https://ambientcg.com/a/PavingStones036).
- Pirate Kit models by Kenney, CC0 1.0.
- KayKit Block Bits models by Kay Lousberg, CC0 1.0.
- Edit your displayed player name in the top bar.

The shared starter world is generated from a random 32-bit seed shown in the top bar. The seed deterministically generates terrain, forested foothills, mountain ranges, a flat spawn village, and four remote islands surrounded by wide, deep, connected seas, with villages, dungeons, and ruins to discover. Public starter and island village buildings have beds and tables, and the harbor Boat Workshop has workbenches; purchasable Glass City residences are left unfurnished. Doors render with raised panels, frames, and handles. Glass City features wider paved streets, marked lanes, sidewalks, glass-fronted storefronts, and rigid exterior-mounted shop signs. The harbor includes a glass-windowed Boat Workshop where players can design and launch custom boats for island travel. Glass City has colorful traffic and additional tanks, and the airport has three drivable fighter jets. Chunks are generated around each player and unloaded behind them. Set `WORLD_SEED` to a number from `0` to `4294967295` when starting the server to generate the same terrain again. Mining works underground down to the unbreakable bedrock layer, with gravity and landing on exposed blocks. The world includes a small house, buildable blocks, inventory, crafting, dropped items, and three server-simulated village bots that wander locally, approach nearby players, and steer around solid blocks. It also has a generated creature catalogue with 256 species variants each for the village, coast, ocean, forest, and highlands (1,280 variants total), plus six flying dragons roaming the starter region and island skies. A small habitat-specific selection roams each region at once; names, animal model forms, colors, and sizes vary by world seed. Players can fight active monsters, including spiders, golems, and phantoms that awaken near their lairs, earn XP and coins, and spend coins on placeable procedural models at the village market. World edits and player inventory/progression are included in world saves and autosaves; without saving, data is held in server memory. Browser profiles are not authenticated accounts.

## Minecraft mod compatibility

Minecraft Java mods built for Forge or Fabric cannot be loaded directly by this Node.js/browser game: they target Minecraft's Java runtime and mod APIs, not this game's WebSocket protocol or Three.js client. Bedrock add-ons have a separate format and runtime too. A feature can be recreated or ported as original game code, and individual mod assets/code can only be reused if their license explicitly allows it and its terms are followed. Do not redistribute Minecraft's proprietary assets or code. A future Voxland plugin API could let original community extensions register blocks, items, recipes, and bots.

## Asset and code credits

Block texture packs are bundled in `src/assets/blocks/own/`, `src/assets/blocks/pixel-perfection/`, and `src/assets/blocks/vibes/` so the game client does not depend on the Voxelize submodule at runtime or build time. Pack folders are kept separate because their textures have overlapping filenames. The game currently uses textures from `own/`.

Voxelize's README attributes Pixel Perfection by XSSheep, modified, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); redistributed adaptations of those textures must follow its attribution and share-alike terms. The repository did not provide separate license metadata for the `own` and `vibes` packs, so verify their provenance and usage rights before redistributing them outside this project.

The Voxland client/server code and generated campfire texture are original and separate from the Voxelize runtime. Check individual licenses before reusing other third-party assets or code.

In-game animals and fish use block-form meshes with species-specific colors and shapes. The repository also retains animal GLTF source files from Quaternius' [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); these source models are not loaded by the game.

The supplied Block Bits glTF models in `src/assets/Assets/gltf/` use the supplied texture atlas in `src/assets/Textures/`. No source or license metadata was included with those files; verify their redistribution terms before publishing the game or its assets.

The low-poly plane FBX models use their matching livery textures from the adjacent `.fbm/` folders; these images are bundled into the client and applied when the models load.

Three weapon models (blaster-a, blaster-b, and blaster-c) are from Kenney's [Blaster Kit](https://kenney.nl/assets/blaster-kit), licensed CC0 1.0. The pack's license is included at `src/assets/kenney-blaster-kit/License.txt`.

The imported furniture and medieval weapons models in `src/assets/mods/quaternius-furniture/` and `src/assets/mods/quaternius-medieval-weapons/` are from Quaternius' [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) and [Modular Weapons Pack](https://quaternius.com/packs/medievalweapons.html), respectively. Both packs are licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Their FBX files contain UVs and material names but no image maps; the client supplies wood, metal, gold, and fabric textures from bundled packs at load time.
# JesseCraft
