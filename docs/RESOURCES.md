# Darkmoon Resources Guide

This document provides a comprehensive overview of all resources available in the Darkmoon game project.

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Game Configuration](#game-configuration)
4. [Manifest System](#manifest-system)
5. [Sprite Sheets](#sprite-sheets)
6. [Shaders](#shaders)
7. [Input Bindings](#input-bindings)
8. [Scene Saves](#scene-saves)
9. [Fonts](#fonts)

---

## Overview

Darkmoon uses a **resource-centric architecture** where all game assets and configurations are stored in the `Resources/` directory. The system is built around:

- **YAML-based configuration** for human-readable, version-control friendly asset definitions
- **Centralized manifest system** for asset discovery and registration
- **Modular shader system** with GLSL shaders compiled to SPIR-V
- **Entity Component System (ECS)** compatible scene serialization

---

## Directory Structure

```sh
Resources/
├── game.yaml                 # Main game configuration
├── keybindings.yaml          # SDL keycode mappings
├── input_bindings*.json      # Advanced input configurations
├── manifests/                # Central resource registry
│   └── resource_manifest.yaml
├── SpiteSheets/              # Sprite and tileset definitions
│   ├── characters/           # Player and NPC sprites
│   └── *.yaml                # Tile and object definitions
├── shaders/                  # GLSL vertex/fragment shaders
│   └── compiled/             # SPIR-V compiled binaries
├── Fonts/                    # TTF font files
├── saves/                    # Scene save files
└── mystic_woods_2.2/         # Tileset texture assets
```

---

## Game Configuration

### game.yaml

The main configuration file containing all game settings organized into sections:

| Section | Description | Key Settings |
| --------- | ------------- | -------------- |
| **window** | Display settings | 1280x720, fullscreen, vsync, resizable |
| **graphics** | Rendering options | 60 FPS target, anti-aliasing, post-processing |
| **world** | World dimensions | 100x100 tile grid, 16px tile size |
| **player** | Player stats | spawn position, health, stamina, movement speed (120px/s) |
| **camera** | Camera behavior | follow player, smoothing (0.15), zoom, shake effects |
| **physics** | Physics simulation | gravity (980.0), friction (0.85), air resistance (0.95) |
| **input** | Default controls | WASD movement, Space jump, Shift dash, E interact |
| **audio** | Volume levels | master (1.0), music (0.7), SFX (0.8), ambient (0.5) |
| **ui** | Interface options | HUD, inventory (20 slots), hotbar (8 slots) |
| **gameplay** | Game rules | difficulty, permadeath, auto-save interval (300s) |
| **particles** | Particle limits | max 1000, pool size 500 |
| **animation** | Animation defaults | frame duration 0.1s, sprite flip support |
| **collision_layers** | Collision groups | world, player, enemies, items, projectiles |
| **game_states** | State machine | main_menu, gameplay, pause, inventory, settings, game_over |

---

## Manifest System

### Resource Manifest (`manifests/resource_manifest.yaml`)

The central registry that maps all tilesets and fonts for the game engine to discover.

#### Structure

```yaml
tilesets:
  - name: "plains"
    yaml: "SpiteSheets/grass.yaml"
    texture: "mystic_woods_2.2/ground/plains.png"

fonts:
  - name: "default"
    file: "Fonts/Renogare.ttf"
```

#### Currently Registered Tilesets

| Name | Description |
| ------ | ------------- |
| `plains` | Basic grass terrain |
| `fences` | Fence tiles and posts |
| `water` | Water and shore tiles |
| `decor-8` | 8x8 decoration sprites |
| `decor` | Standard decoration tiles |
| `walls` | Wall tiles |
| `carpet` | Interior floor carpet |
| `blue_carpet` | Blue carpet variant |

See [manifests/README.md](../Resources/manifests/README.md) for the complete manifest format guide.

---

## Sprite Sheets

Located in `Resources/SpiteSheets/`, each sprite sheet has a YAML definition file paired with PNG textures.

### Character Sprites

**`characters/player.yaml`**

- Tile size: 48x48 pixels
- Animations: idle, run, attack (4 directions each)
- Layers: player

### Object Tiles

**`objects.yaml`** - 32 interactive objects including:

| Category | Examples |
| ---------- | ---------- |
| Signs | sign_left, sign_right |
| Containers | well, crate, barrel, pot, vase |
| Furniture | chair, table, bed |
| Collectibles | coin, gem, key, potion |
| Decorations | lamp, statue |

### Terrain Tiles

| File | Description |
| ------ | ------------- |
| `grass.yaml` | Grass terrain variants |
| `dirt-grass.yaml` | Dirt and grass transitions |
| `cliffs.yaml` | Cliff and elevation tiles |
| `water-sheet.yaml` | Water and shore tiles |
| `rock_in_water_frames.yaml` | Animated water rocks |

### Decoration Tiles

| File | Description |
| ------ | ------------- |
| `flowers.yaml` | Flower decorations |
| `plants.yaml` | Plant sprites |
| `shrooms.yaml` | Mushroom decorations |
| `fences.yaml` | Fence tiles |
| `decor_8x8.yaml` | Small 8x8 decorations |
| `decor-grass.yaml` | Grass decorations |

### Floor Tiles

| File | Description |
| ------ | ------------- |
| `carpet_blue.yaml` | Blue carpet tiles |
| `carpet_red.yaml` | Red carpet tiles |

### Tile YAML Format

```yaml
meta:
  tile_size: 16            # Pixel dimensions
  frames: 1                # Animation frames
  file: ["texture.png"]    # Associated textures

tiles:
  - id: 0
    type: "tile_name"
    atlas_x: 0             # Position in texture atlas
    atlas_y: 0
    layer: "ground"        # ground | object | decoration
    category: "terrain"    # terrain | interactive | furniture | collectible
    walkable: true
    has_collision: false
    interactable: false
    destructible: false
    collectible: false
    footstep_sound: "grass"
    z_bias: 0              # Rendering depth
    editor_color: "#00FF00"
```

---

## Shaders

Located in `Resources/shaders/`. All shaders are GLSL vertex/fragment pairs compiled to SPIR-V.

### Core Rendering

| Shader | Description |
| -------- | ------------- |
| `basic` | Pass-through with vertex colors |
| `sprite` | 2D sprite rendering with texture sampling and tinting |

### Post-Processing Effects

| Shader | Description |
| -------- | ------------- |
| `bloom` | Glow effect |
| `blur` | 9-tap box blur |
| `crt` | CRT monitor effect with scanlines and barrel distortion |
| `pixelate` | Retro pixelation |
| `vignette` | Edge darkening |

### Color & Tone

| Shader | Description |
| -------- | ------------- |
| `day_night` | Dynamic lighting cycle |
| `grayscale` | Desaturation |
| `sepia` | Warm tone filter |
| `palette_swap` | Color palette cycling (3 palettes) |

### Visual Effects

| Shader | Description |
| -------- | ------------- |
| `psychedelic` | Color cycling, wave distortion, chromatic aberration |
| `kaleidoscope` | Mirror/reflection patterns |
| `water` | Animated ripple distortion |

### Gameplay Effects

| Shader | Description |
| -------- | ------------- |
| `damage_flash` | Red flash with fade (0.3s) |
| `dissolve` | Disintegration with glow |
| `fade` | Fade to black |
| `outline` | Pulsing yellow highlight |
| `ghost` | Translucent blue with wave distortion |

### Status Effects

| Shader | Description |
| -------- | ------------- |
| `freeze` | Icy blue crystalline shimmer |
| `poison` | Green pulsing bubbles |
| `lightning` | Electric blue arcs |
| `heat_distortion` | Rising heat waves |

### Magic & Special

| Shader | Description |
| -------- | ------------- |
| `glow` | Cyan-blue pulsing enchantment glow |
| `shield` | Hexagonal energy shield |
| `portal` | Swirling vortex with spiral distortion |

### Compiling Shaders

```bash
# Windows
Resources/shaders/compile_shaders.bat

# Linux/Mac
Resources/shaders/compile_shaders.sh
```

Requires the Vulkan SDK to be installed. Compiled SPIR-V binaries are output to `shaders/compiled/`.

See [shaders/README.md](../Resources/shaders/README.md) for the complete shader documentation.

---

## Input Bindings

### keybindings.yaml

Simple SDL keycode to action mappings:

```yaml
move_up: SDLK_w
move_down: SDLK_s
move_left: SDLK_a
move_right: SDLK_d
jump: SDLK_SPACE
dash: SDLK_LSHIFT
interact: SDLK_e
attack: SDLK_j
special: SDLK_k
```

### input_bindings.json

Advanced context-based input system supporting:

- **Multiple input sources per action** (keyboard, gamepad buttons, analog axes)
- **Context switching** (different input configurations for different game states)
- **Dead zone configuration** (0.15 default for analog inputs)
- **Scale/sensitivity per binding**

---

## Scene Saves

Located in `Resources/saves/`. Uses YAML-based serialization for game state persistence.

### Features

- Entity persistence with ECS components
- Automatic sprite sheet reference restoration by name
- Scene-specific data extensibility

### Supported Components

| Component | Description |
| --------- | ------------- |
| Position | Entity world position |
| Velocity | Movement vector |
| Size | Entity dimensions |
| Sprite | Visual representation |
| Animation | Animation state |
| Collision | Collision properties |
| Health | Health/damage system |

### Hotkeys

| Key | Action |
| ----- | -------- |
| F5 | Quick Save |
| F6 | Quick Load |

See [saves/README.md](../Resources/saves/README.md) for the complete save format documentation.

---

## Fonts

Located in `Resources/Fonts/`.

### Available Fonts

| Font | File | Usage |
| ------ | ------ | ------- |
| Renogare | `Renogare.ttf` | Default UI font |

Fonts are registered in the resource manifest and loaded at game startup.

---

## Adding New Resources

### Adding a New Tileset

1. Create the PNG texture file
2. Create a YAML definition in `SpiteSheets/`
3. Register in `manifests/resource_manifest.yaml`

### Adding a New Shader

1. Create `.vert` and `.frag` files in `shaders/`
2. Run the compile script to generate SPIR-V
3. Reference by name in game code

### Adding a New Font

1. Place TTF file in `Fonts/`
2. Register in `manifests/resource_manifest.yaml`

---

## Related Documentation

- [Manifest Format Guide](../Resources/manifests/README.md)
- [Scene Save Format](../Resources/saves/README.md)
- [Shader System](../Resources/shaders/README.md)
