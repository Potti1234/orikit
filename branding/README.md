# Orikit brand kit

Orikit — *ori* (折り, "to fold") + kit. The Foldkit-compatible Elm architecture,
unfolded natively onto mobile.

## Personality

Calm, precise, native (see `PRODUCT.md`). The brand voice states verifiable
facts and avoids hype. Origami is the carrier: folding is calm precision, and
the crane is something folded that flies.

## The mark

The canonical mark is the geometric origami crane, right-facing, five flat
facets. The vector masters are the single source of truth:

- `logo/orikit-mark.svg` — monochrome master (`currentColor`, use for any color)
- `logo/orikit-mark-accent.svg` — accent variant: tall wing in vermilion

Rules:

1. One crane geometry everywhere. Do not use the other generated crane poses
   (`logo/crane-mark-*.png` are archived exploration, not brand assets).
2. The wordmark is always real typography — lowercase "orikit" in
   Space Grotesk Bold, letter-spacing -0.02em — never an image of text.
3. Lockup: mark left, wordmark right, gap ≈ 0.35× mark height.

## Color

| Token | Hex | Role |
|---|---|---|
| Paper (washi) | `#F7F4EE` | Light ground — warm white, never pure `#FFF` |
| Ink | `#16213A` | Text on light; dark ground |
| Indigo | `#3D46A2` | Primary brand color, links, code accents |
| Vermilion | `#EB5E28` | The single accent — one appearance per viewport |
| Crease light | `#DDD7CB` | Hairlines, borders on paper |
| Crease dark | `#26324D` | Hairlines, borders on ink |

Accent discipline: vermilion appears **once per viewport** — a CTA *or* the
accent wing, never both. Everything else is ink on paper.

## Typography

- **Display:** Space Grotesk (500/700) — headlines, wordmark
- **Body:** Inter (400/600)
- **Utility:** JetBrains Mono (400/500) — eyebrows, labels, code, evidence paths

## Motif

Origami crease-pattern diagrams (thin solid + dashed fold lines) are the only
permitted decoration: `hero/crease-pattern-{light,dark}.png`, or better, inline
SVG lines in brand colors. No gradients, no glass, no shadows beyond one soft
card shadow, no photorealistic renders.

## Asset inventory

- `logo/orikit-mark.svg`, `logo/orikit-mark-accent.svg` — vector masters
- `icons/app-icon-{light,dark,vermilion}.png` — app icon colorways (source of
  the canonical crane geometry)
- `hero/crease-pattern-{light,dark}.png` — background textures
- `hero/og-banner.png` — placeholder social banner (crane pose diverges from
  the canonical mark; re-composite from the SVG before real use)
- `../site/index.html` — landing page (self-contained, embedded fonts)

## Naming facts (checked 2026-07-30)

Free at check time: npm `orikit`, GitHub org `orikit`, PyPI, crates.io,
orikit.dev/.app/.io, TikTok, Bluesky. Taken: orikit.com (parked),
Instagram/YouTube @orikit (small cooking-kit brand, unrelated class).
No ORIKIT trademark in the US register; EU/DPMA check via
[TMview](https://www.tmdn.org/tmview/) still to be done manually.
No problematic Japanese meaning: オリキット reads as "folding kit" /
"original kit".

Orikit is not affiliated with, endorsed by, or maintained by Foldkit,
NativeScript, JetBrains, Google, or Apple.
