# Design plan: the Summoning Circle site

## Brief
- **Subject:** a developer toolkit that runs AI models inside the browser, themed as a summoning ritual.
- **Audience:** hackathon judges first (10 seconds to "get it"), web developers second.
- **Primary job:** show, on the page itself, that a model is summoned *into your browser*, then explain the three layers and the two apps.

## First draft and why it was revised
First draft: near-black page, one orange accent, Cormorant serif headline, centered hero, three identical feature cards. That is the generic dark-Halloween default (near-black plus one bright accent, the SaaS card kit). Revised:

| Axis | Default I rejected | Choice for this brief |
|---|---|---|
| Ground | near-black `#0d0a14` | **Chalk on slate.** A mid-dark blue-grey slate floor with the circle drawn in chalk. Rituals are drawn on floors; slate carries texture and isn't black. |
| Accent | one acid accent | **Two functional inks.** Candle amber = things you can do. Spirit violet = things the AI produced. Nothing else is colored. |
| Display type | Cormorant Garamond | **IM Fell English.** A digitized 1600s English type: reads like an old grimoire, rare on the web. Used large and sparingly. |
| Body type | Inter | **Atkinson Hyperlegible.** Designed for low-vision readers; fits a product that cares about access. |
| Hero | headline + stat + gradient | **A working ritual.** The circle is the hero and it *does* something: press Summon and it draws itself as the download progresses. |
| Sections | identical rounded cards | **Each app gets its own world.** Possessed is lurid and loud; 3 AM is quiet moonlit blue. The two panels deliberately don't match. |

## Tokens
- Slate `#23272e` (page), Slate-deep `#1a1d22` (wells), Chalk `#ebe6da` (text, lines), Chalk-dim `#a9a597` (secondary), Candle `#f2a541` (actions), Spirit `#b9a6ff` (AI output)
- App worlds: Possessed `#9bff5a` on `#16210f`; 3 AM `#9cc3ff` on `#121a2a`
- Type scale (1.333, perfect fourth): 14 / 18 / 24 / 32 / 42 / 56 / 75 px

## Layout
```
┌──────────────────────────────────────────────┐
│ Summoning Circle                     GitHub  │
│                                              │
│   Summon AI into          ╭──── circle ───╮  │
│   your browser.           │   sigils +    │  │
│   short line              │   progress    │  │
│   await summon("llm")     ╰───────────────╯  │
│   [Summon]                                   │
├──────────────────────────────────────────────┤
│ What your device can summon  (real probe)    │
├──────────────────────────────────────────────┤
│ Three layers: Circle / Ritual / Apps (stack) │
├──────────────────────────────────────────────┤
│ [ Possessed: loud world ][ 3 AM: quiet world]│
├──────────────────────────────────────────────┤
│ footer                                       │
└──────────────────────────────────────────────┘
```
Text left-aligned. On mobile the circle moves above the headline.

## Principles
1. **One bold thing:** the circle. Everything else stays quiet.
2. **Honest:** the device probe uses real browser APIs. The summon in the hero is labeled as a preview until the runtime exists.
3. **Motion only in answer to the user**, apart from one slow candle flicker. Reduced motion is respected.
4. **Fonts are self-hosted:** the site makes no third-party requests, matching the product's privacy promise.
