# Pirate Kit — Ships and Boats Selection

11 native static GLB models from Kenney's Pirate Kit 2.1. Original assets by Kenney; unofficial selection and packaging by Eclair Assets. Not affiliated with or endorsed by Kenney.

## What is included

Seven complete ship assemblies with sails, two rowboats with paddles and two bare mast/yardarm/flag assemblies. The standalone masts have no cloth sails; mast-ropes.glb also includes rigging. Native model contents remain unchanged. This is a selected subset, not the full Pirate Kit.

| File | Triangles |
| --- | ---: |
| boat-row-large.glb | 174 |
| boat-row-small.glb | 168 |
| mast-ropes.glb | 350 |
| mast.glb | 302 |
| ship-ghost.glb | 1,703 |
| ship-large.glb | 1,849 |
| ship-medium.glb | 1,723 |
| ship-pirate-large.glb | 1,938 |
| ship-pirate-medium.glb | 1,812 |
| ship-pirate-small.glb | 1,461 |
| ship-small.glb | 1,370 |

All eleven files together: 12,850 triangles, zero animation clips and zero skins. They are static assets, not advertised as animated. There is one shared 512 × 512 PNG color palette. No shipwreck, plants, islands, characters, fortress or loose cannons are included. Three pirate-ship variants retain generic skull motifs on their front sails. Preview galleries frame each model independently; they are not comparisons of relative scale.

## Import and keep the colors

1. Extract the whole package first.
2. Import a model from `Models/GLB format/`.
3. Keep `Models/GLB format/Textures/colormap.png` in that exact subfolder. Every model references `Textures/colormap.png`.
4. To relocate a model, move its `Textures` subfolder with it. Moving the GLB alone may lose the colors. For correct palette appearance, use an importer supporting external PNG references and `KHR_texture_transform` (listed by these GLBs under `extensionsUsed`, not `extensionsRequired`).

These GLBs are not self-contained. No embedding or conversion has been applied, and no source model geometry, material or palette bytes have been changed. Confirm scale, orientation and appearance in your own application; no specific application or physical unit scale is certified.

## License and source

The original models and palette are CC0 1.0. The embedded original `License.txt` is retained. Personal, educational and commercial use are allowed; author credit is optional. Source: [Kenney Pirate Kit](https://kenney.nl/assets/pirate-kit). License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

If you want to credit the source: “Pirate Kit by Kenney — kenney.nl (CC0). Unofficial selection by Eclair Assets.”

Eclair Assets' selection documentation and verification script add no restriction to the original assets; these original documentation/code contributions are also offered under CC0 1.0. No affiliation, endorsement or permission to use Kenney branding is implied.

## AI-assistance disclosure

AI assisted Eclair Assets with documentation and verification/viewing/composition code. The supplied models and palette are unchanged bytes from Kenney's archive; no AI-generated model or texture content was added by Eclair Assets. The original creator's complete production process has not been independently verified, so this is not a claim that the upstream assets were made without AI.

## Optional payment

The intended itch.io release is a free ($0) download with an optional suggested $1 tip. No payment is required. If the itch.io payment prompt appears, use “No thanks, just take me to the downloads.” If you received this archive before publication, its existence alone does not confirm a live itch.io page; the public free route is verified separately at release.

## Check the payload

`MODEL_MANIFEST.json` lists the exact eleven models, palette and original license, including SHA-256 and sizes. `Verify-Payload.ps1` checks those 13 files without modifying them or using the network. Use PowerShell 7 (`pwsh`) and review the script under your own system's execution policy; do not weaken a permanent policy just for this check:

```powershell
pwsh -NoProfile -File .\Verify-Payload.ps1 -PayloadRoot "C:\path\to\extracted-package"
```

The payload root is the folder containing `License.txt` and `Models`. Success prints JSON with `"passed": true`. The check covers payload integrity and the model-folder file list, not a digital signature, visual quality, commercial fitness, a ZIP checksum, or application compatibility.

Native Khronos validation on 2026-09-08 used version 2.0.0-dev.3.10: 0 errors, 0 warnings, 59 informational messages. Those messages describe the supplied external palette (11) and preserved unused tangents (48); they are not “all-severity zero.”
