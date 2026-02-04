# Graphics TODO (Migration + Polish)

## Asset pipeline
- Fix Vite `publicDir` to serve `src/Resources/` content.
- Make all runtime asset/config loads base-aware (`import.meta.env.BASE_URL`), avoid hardcoded absolute `/...` paths.
- Add a single “core” asset manifest (player/enemies/tiles) and keep “minimal” for fast boot.

## World rendering
- Hook `TileMap` to a real terrain spritesheet (more than 1 grass variant) and re-enable noise variation visually.
- Add decoration layer placement (flowers/fences/objects) with deterministic seeds.
- Add optional debug overlays: collision tiles, spawn bounds, camera bounds.

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

