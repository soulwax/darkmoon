# Sprite Manifests

This directory contains YAML manifest files that define how spritesheets should be loaded and sliced into individual sprites and animations.

## Manifest Format

```yaml
spritesheet:
  name: "unique_identifier"          # Unique name for this spritesheet
  texture: "../path/to/texture.png"  # Path relative to this YAML file

  sprites:
    # Single sprite (static image)
    - name: "sprite_name"
      type: "single"
      x: 0
      y: 0
      width: 48
      height: 48

    # Animation (sequential frames in a row/grid)
    - name: "animation_name"
      type: "animation"
      x: 0                    # Starting X position
      y: 0                    # Starting Y position
      frame_width: 48         # Width of each frame
      frame_height: 48        # Height of each frame
      frame_count: 6          # Total number of frames
      columns: 6              # Frames per row (wraps to next row)
      frame_duration: 0.1     # Duration per frame in seconds
      loop: true              # Whether animation loops

    # Grid-based tileset (auto-generates all tiles)
    - name: "tile_prefix"
      type: "grid"
      tile_width: 16
      tile_height: 16
      columns: 0              # Auto-calculate from texture width
      rows: 0                 # Auto-calculate from texture height

    # Manual frames (for irregular animations)
    - name: "custom_animation"
      type: "frames"
      loop: true
      frame_list:
        - { x: 0, y: 0, width: 48, height: 48, duration: 0.1 }
        - { x: 48, y: 0, width: 48, height: 48, duration: 0.1 }
        - { x: 96, y: 0, width: 64, height: 64, duration: 0.2 }
```

## Sprite Types

### `single`
A static sprite with a single frame.

**Required fields:**
- `name`: Sprite identifier
- `x`, `y`: Position in texture
- `width`, `height`: Sprite dimensions

### `animation`
Sequential frames arranged in a grid pattern.

**Required fields:**
- `name`: Animation identifier
- `x`, `y`: Starting position
- `frame_width`, `frame_height`: Frame dimensions
- `frame_count`: Total frames
- `columns`: Frames per row

**Optional fields:**
- `frame_duration`: Seconds per frame (default: 0.1)
- `loop`: Loop animation (default: true)

### `grid`
Auto-generates sprites from a tileset.

**Required fields:**
- `name`: Base name for tiles (tiles named `{name}_0`, `{name}_1`, etc.)
- `tile_width`, `tile_height`: Tile dimensions

**Optional fields:**
- `columns`, `rows`: Grid size (auto-calculated if 0)

### `frames`
Manually define each frame (for irregular layouts).

**Required fields:**
- `name`: Animation identifier
- `frame_list`: Array of frame definitions

**Optional fields:**
- `loop`: Loop animation (default: true)

## Usage in Code

```cpp
// Load manifest
resourceManager.loadSpriteSheetFromYAML("Resources/manifests/player.yaml");

// Get spritesheet
auto* sheet = resourceManager.getSpriteSheet("player");

// Get specific sprite/animation
auto* walkAnim = sheet->getSprite("walk_down");

// Or get directly from resource manager
auto* idleAnim = resourceManager.getSprite("player", "idle_down");
```

## Example Manifests

- [player.yaml](player.yaml) - Player character animations
- [slime.yaml](slime.yaml) - Slime enemy animations
- [tilesets.yaml](tilesets.yaml) - Terrain tilesets

## Creating New Manifests

1. Identify your spritesheet texture and its layout
2. Create a new `.yaml` file in this directory
3. Define the spritesheet name and texture path
4. Add sprite/animation definitions based on the layout
5. Load in your game using `ResourceManager::loadSpriteSheetFromYAML()`

## Tips

- Use image editing software to measure pixel positions
- Group related animations in the same manifest file
- Use descriptive names: `player_walk_down` not just `walk1`
- Set `loop: false` for one-shot animations (attacks, death, etc.)
- Adjust `frame_duration` to control animation speed
