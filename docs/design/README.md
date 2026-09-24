# Design assets — tier-1 Smart Office UI

Figma-importable artefacts for the tier-1 booking journey (FR-03 / FR-08 /
FR-09). Full rationale and redlines: [`tier1-ui-spec.md`](./tier1-ui-spec.md).

| File | What it is | Import into Figma |
|---|---|---|
| `tier1-ui-mockups.svg` | Foundations, components and both screens as artboards | **Drag the file onto the Figma canvas** (or File → place). It imports as editable vector frames + text layers. |
| `tier1-ui-tokens.json` | Design tokens (colour, type, spacing, radius) | Install the **Tokens Studio for Figma** plugin → *Load / Import* → pick this file. Applies as Figma styles/variables. |
| `tier1-ui-spec.md` | Written spec: token tables, component states, screen states, a11y, content | Reference doc — the design source of truth. |

## Suggested workflow

1. Import `tier1-ui-tokens.json` via Tokens Studio to create the colour/type
   styles.
2. Drag in `tier1-ui-mockups.svg` for the layout; detach/clean up groups into
   proper Figma frames and components as needed.
3. Use `tier1-ui-spec.md` for the details the flat mockup can't show:
   interaction states, error copy mapped to API reasons, and accessibility
   annotations.

## Notes

- Figma has no hand-authorable native `.fig` format; SVG + a tokens plugin is
  the reliable import path.
- Emoji/glyph icons in the SVG are placeholders — swap for a proper icon set
  (e.g. Lucide/Feather) on rebuild.
- Everything simulated (the sign-in stub) is labelled, per repo ground rules.
