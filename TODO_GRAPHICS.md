# Graphics TODO (Migration + Polish)

## Asset pipeline
- [x] Fix Vite `publicDir` to serve `src/Resources/` content.
- [x] Make all runtime asset/config loads base-aware (`import.meta.env.BASE_URL`), avoid hardcoded absolute `/...` paths.
- [x] Add a single “core” asset manifest (player/enemies/tiles) and keep “minimal” for fast boot.
- [x] Fix spritesheet YAML `meta.file`/`meta.files` filename mismatches.

## World rendering
- [x] Hook `TileMap` to spritesheet terrain (grass + overlays).
- [x] Add decoration layer placement (flowers/shrooms/rocks) with deterministic seed.
- [x] Add a simple pond + dirt road stamping near spawn.
- [x] Support multi-image animated tile sheets via `meta.files` (water + rock-in-water).
- [x] Add interactable chest placement with loot rewards.
- [ ] Add more terrain variants (cliffs, fences, carpets/floors) into world gen.
- [x] Add tile collision and keep player/enemy movement in-bounds.
- [ ] Add optional debug overlays: collision tiles, spawn bounds, camera bounds.

## Characters/enemies
- Convert enemy sprite rendering to `SpriteSheet` + `AnimatorComponent` (match player approach).
- Add enemy hit flash / tint via sprite draw options (avoid `ctx.filter` where possible).
- Add consistent shadow sizing using sprite frame dimensions.

## VFX and weapons
- Add sprite-based projectile and impact effects (missiles/orbs/lightning).
- Add screen-space post FX: vignette, mild CRT/scanlines toggle, damage flash.
- Add camera shake presets per weapon/enemy hit.

## Performance
- Batch/dedupe draw calls where possible (tile culling already present).
- Add simple sprite/particle culling bounds per system.
