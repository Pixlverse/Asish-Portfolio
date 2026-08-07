# Asish Thomas Murickaveli — Personal Site

Static site. HTML5 + CSS3 + vanilla JavaScript. No frameworks, no build step, no dependencies.

## Run

Any static server works — open it over `http://`, not `file://` (the Google Fonts
request and relative paths behave better):

```bash
python3 -m http.server 4321
# → http://localhost:4321
```

## Structure

```
index.html          Single page, semantic sections, JSON-LD person schema
css/
  variables.css     Design tokens — colour, type scale, spacing, motion, layers
  base.css          Reset, document, type primitives, animation primitives, reduced-motion
  components.css    Preloader, cursor, ambient light, grain, nav, menu, rail, buttons, marquee, accordion
  sections.css      Page composition, hero → footer
  responsive.css    Structural breakpoints + print
js/
  main.js           12 self-contained modules (see the header comment)
assets/img/         Placeholder SVGs — replace all four
```

## Replace the placeholders

| File | Used by | Suggested asset |
|---|---|---|
| `assets/img/portrait.png` + `.webp` | Hero | **Supplied** — cut-out portrait, transparent background, trimmed to 767×984 |
| `assets/img/hiwaga.svg` | Hiwaga Makers | Studio / team / work shot, 4:5 crop |
| `assets/img/hiwaga-logo.png` + `.webp` | Hiwaga Makers | **Supplied** — white wordmark on transparent |
| `assets/img/film.svg` | Film section | On-set still, wide 16:9 |
| `assets/img/favicon.svg` | Browser tab | Wordmark or initial |

Swap the `src` in `index.html` (keep `loading="lazy"` on everything except the hero,
which is deliberately eager and `fetchpriority="high"`). Images are rendered with
`filter: grayscale(100%)` — colour originals are fine.

The hero portrait is already in place. It came from `image.png` in the project root
(1536×1024); that source is untouched and can be deleted once you're happy — the site
uses the trimmed exports in `assets/img/`. WebP (185 KB) is served first, PNG (1 MB)
is the fallback for older Safari, and the image is preloaded as the LCP element.

Because the background is transparent, the subject stands **in front of** the oversized
red word with no masking tricks needed; only the bottom edge is feathered where the crop
meets the section boundary. The subject's right edge is pinned to the inner boundary of
the stats rail, so it never runs under the numbers at any width. Replacing it means
keeping the same treatment: a cut-out on transparency, cropped at the chest.

## Content to fill in

- Social links: `#` placeholders in the footer.
- The Hiwaga logo and button already point at https://www.hiwagamakers.com/ (new tab).
- `hello@asishthomas.com` — the contact email, in two places.
- The numbers in the hero rail and the Impact section (`data-count`): 40 / 100 / 8 / 4.
- Canonical URL and `og:image` in `<head>`.

## Type

The target face is **SF Pro Display**. Apple's licence does not allow serving it as a
webfont, so the stack asks for the real thing first:

```
-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
'Helvetica Neue', 'Inter Tight', Inter, Helvetica, Arial, sans-serif
```

On any Mac, iPhone or iPad that resolves to genuine SF Pro with correct optical
sizing — identical to the reference. Windows and Android fall back to Helvetica Neue,
then Inter Tight (the closest freely-licensable grotesk), which loads from Google
Fonts. `Parisienne` is the signature script — it sets the header wordmark, the hero's
"Hello, I'm" and the footer's "the" flourish; `Italiana` sets the footer wordmark name, and `Anton` — one heavy condensed weight —
carries the industries strip.

## Colour

Black and white carry the page; a single red is the only accent.

| Token | Value | Used for |
|---|---|---|
| `--accent` | `#c9a227` | Hero tagline, stats, availability dot, payoff phrases (`.hl`) |
| `--accent-bright` | `#e8c14a` | Top of the display-word gradient |
| `--accent-deep` | `#6b5310` | Bottom of that gradient |
| `--accent-glow` | `rgba(201,162,39,.16)` | Ambient light, hero and footer bloom |

One payoff phrase per statement carries the accent — `build movements.`, `Trust.`,
`Leave a lasting impact.` Wrap any phrase in `<span class="hl">` to add another, but
keep it to one per section or it stops reading as emphasis.

Change `--accent` and the two gradient stops in `css/variables.css` and the whole site
follows — nothing hard-codes the colour except the alpha variants in the hero, which
use the same RGB triplet.

The oversized `INFLUENCE` sits at `opacity: 0.55` (0.34 on phones) so it reads as a
backdrop rather than a second headline. That single value is the dial for how loud it is.

## Notes

- **Motion** — every animation is gated on `prefers-reduced-motion`. With it enabled,
  content appears instantly and the grain, parallax and marquee are disabled.
- **Parallax** writes to the CSS `translate` property, not `transform`, so it composes
  with any transform the stylesheet already applies (the display word's centring, for
  one) rather than overwriting it.
- The native cursor is used throughout — no custom cursor, and no pointer-following
  glow. Hover feedback lives on the elements themselves: story rows draw a gold rule
  and step forward, cards light up, buttons wipe and pull toward the pointer.
- **The journey track** (`#track`) shows every chapter at once — nothing behind a click.
  The connecting line fills as the section crosses the viewport (JS writes `--fill`, CSS
  scales the bar), each step lifts on hover with its node igniting gold, and the future
  chapter keeps a dashed node and an outlined year. It's an auto-fit grid, so adding a
  chapter in `index.html` just reflows; below 1024px it stacks and the line runs vertically.
- **The three pillars are cards** (`.card`) with a pointer-tracked spotlight: JS writes
  `--mx` / `--my`, CSS does the rest. On touch and with reduced motion the JS never
  binds and the cards render as static.
- **No chapter labels.** Sections are separated by hairlines and whitespace alone;
  the numbered `01 / THE DIFFERENCE` markers were removed.
- **Navigation** is the fullscreen menu only: the header carries the brand mark and a
  single toggle at every width. The toggle sits above the menu in the stacking order,
  so it doubles as the close button. Menu items live in `index.html` (`.menu__list`) —
  add or remove them freely; the two-column grid reflows on its own.
- **No JS** — entrances are gated on a `.js` class set before first paint, so the page
  degrades to fully readable static HTML. A runtime error triggers the same fallback.
- **Scrolling** is native (`scroll-behavior: smooth`), not a transform-based hijack:
  sticky positioning, anchors and accessibility all keep working.
- **Performance** — one shared `requestAnimationFrame` loop drives every per-frame
  effect; scroll position is read once per frame. Reveals use a single
  `IntersectionObserver` and unobserve after firing.
