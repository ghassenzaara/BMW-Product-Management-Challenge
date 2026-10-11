# Awesomic style reference (reconstructed)

> The restyle brief referred to a `style-reference.md` next to `tokens.json`, `variables.css` and `theme.css`, but that file was not attached. This version is **reconstructed** from the role descriptions in `tokens.json`, the values in `variables.css` / `theme.css`, and the translation rules in the brief. Where the three sources and the brief disagree, the brief wins (it was written for this app).

## Character

Calm, monochrome, editorial. A light grey paper canvas, white cards that are separated by 1px hairlines instead of shadows, near-black (obsidian) for headlines and the primary action, and one hot accent (ember) used like punctuation. Generous radii, generous whitespace between sections, compact density inside tables and boards.

## Colour roles

| Token | Hex | Role (from `tokens.json`) |
|---|---|---|
| obsidian | `#09090b` | Primary buttons, headlines, primary text |
| graphite | `#18181b` | Body text; dark surfaces in dark mode |
| slate | `#27272a` | Raised dark surfaces |
| iron | `#3f3f46` | Muted labels, button labels, the "filled tag" |
| steel | `#52525b` | Secondary text |
| fog | `#71717a` | Helper / muted text |
| ash | `#a1a1aa` | Placeholder, disabled |
| mist | `#d4d4d8` | Stronger dividers, subtle borders |
| cloud | `#ececee` | The primary 1px hairline |
| paper | `#f4f4f5` | Page canvas |
| snow | `#ffffff` | Cards |
| subtle card | `#fafafa` | Recessed areas inside cards |
| ember | `#ff5a00` | Accent badges, used sparingly |
| magenta spark | `#fe45e2` | Decorative spark; at most once |

Rules:
- Ember is punctuation only: the active nav indicator, unread or "needs you" counts, the one new/alert highlight chip, and the replay / ripple accent. Never body text, links or large fills.
- Semantic colours (positive, negative, warning, verdicts) keep their hue but are desaturated, and appear as text on a soft tint.
- Charts: a zinc ramp for neutral data, ember for the highlighted path, functional colours only where they carry meaning.

## Type

- Family: DM Sans, weights 300–700. Geist Mono only for IDs and numbers in tables.
- Scale (from `theme.css`): caption 12/1.64, body 15/1.45, body-lg 18/1.45, subheading 20/1.5, heading-sm 32/1.5, heading 40/1.28, heading-lg 56/1.28, display 64/1.12.
- App mapping (brief): body 14–15px / 400; metadata and badges 12–13px; page titles 28–32px / 600, tight leading; section headings 18–20px / 600; display 56–64px / 600 / 1.12 only on login and big hero numbers. No letter-spacing tricks.

## Shape

- Radii (from `variables.css`): badges 12, inputs 14, buttons 14, pills full, cards 36 (marketing scale).
- App mapping (brief): large panels 24–28, cards 20, kanban cards / list rows / popovers 14–16, buttons and inputs 12–14, badges 12 or full pill for status chips, nothing under 12 except table cells and tight inline chips (8).

## Elevation

- Cards carry no drop shadow; a 1px `#ececee` border does the elevation.
- The primary button gets `--shadow-subtle` (inset highlight, inset sheen, 1.5px `#2c2e34` ring, soft drop).
- Popovers, dialogs and sheets may use `--shadow-md` (`rgba(0,0,0,.04) 0 4px 12px`).

## Layout

- Page max width 1200–1280px, centred, for full-bleed text pages.
- Card padding 20–28px, element gap 8px, 24–32px between sections, 4px grid.
- Tables and kanban stay compact.

## Components

- Primary: dark filled (obsidian, white text). Secondary: white with a hairline border. Ghost: no border, zinc text.
- Tags: outlined hairline pills. Filled tag: `#3f3f46` with light text.
- Inputs: white, 14px radius, hairline border, zinc focus ring.
- Sidebar: quiet; the active item gets an obsidian state or a small ember indicator.

## Dark mode

Canvas `#09090b`, cards `#18181b`, raised `#27272a`, borders white at 8–10%, primary = white fill with obsidian text, ember still punctuation only. Both themes must pass contrast.
