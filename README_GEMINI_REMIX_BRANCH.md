# Gemini Remix Branch

This document is a handoff for the experimental Gemini image-generation work that is intentionally kept off `main`.

Use this branch when working on:

- Gemini-powered creative artwork generation
- layout-driven prompt selection
- music-only artwork concepts
- photo-overlay artwork concepts
- future "base image + Gemini edit" workflows

Do not treat this branch as production-ready. The current live app on Vercel should continue to come from `main`.

## What This Branch Is For

The main PaceTune app maps Strava runs to Spotify listening history and renders them in:

- `Messages`
- `List`

This branch adds a third experimental mode:

- `Gemini`

The goal of Gemini mode is to turn run + split + song data into a shareable creative image.

## Product Direction

Current learning:

- full free-form Gemini image generation is visually inconsistent
- the UI/prototyping work is useful
- the prompt/layout system is useful
- the most promising next direction is likely:
  - prepare a set of high-quality base images for music-only artwork
  - store/select those base images
  - feed a chosen base image plus run/song data into Gemini as an edit task
  - let Gemini adapt the artwork to the user data rather than inventing the whole composition every time

That future direction is not implemented yet. This branch is the staging area for that work.

## Files Added For This Branch

### Gemini route and helpers

- [app/api/gemini/remix/route.js](/Users/toni/Documents/pactune/app/api/gemini/remix/route.js)
- [lib/gemini.js](/Users/toni/Documents/pactune/lib/gemini.js)
- [lib/layout-catalog.js](/Users/toni/Documents/pactune/lib/layout-catalog.js)

### Layout catalog

- [geminiprompt_layouts_v2.json](/Users/toni/Documents/pactune/geminiprompt_layouts_v2.json)

### UI work

- [components/sync-panel.js](/Users/toni/Documents/pactune/components/sync-panel.js)
- [app/globals.css](/Users/toni/Documents/pactune/app/globals.css)

## Current Gemini UX

The sync panel now has three top-level view modes:

- `Messages`
- `List`
- `Gemini`

Inside `Gemini`, the current intended flow is:

1. choose a run
2. choose one of:
   - `Auto`
   - `Photo Overlay`
   - `Music Only`
   - `Other`
3. if `Music Only` is selected:
   - choose a music-only layout from a dropdown
4. if `Other` is selected:
   - open the full layout picker modal
5. optionally add creative direction text
6. click `Create Artwork`

## Layout Catalog

The JSON file [geminiprompt_layouts_v2.json](/Users/toni/Documents/pactune/geminiprompt_layouts_v2.json) is the core layout brain for this branch.

It contains:

- `photo_overlay_layouts`
- `music_only_layouts`
- selection logic notes
- multi-song handling rules
- per-layout composition/data-mapping/avoid guidance

Examples of layouts in the catalog:

- `side_margin_strip`
- `bottom_ticker`
- `floating_callouts`
- `strava_card`
- `setlist_tape`
- `running_track`
- `vinyl_disc`
- `waveform_timeline`
- `cassette_tape`
- `gig_poster`
- `mixtape_player`

## Current Prompting Approach

`lib/gemini.js` currently uses a two-step approach:

1. image analysis pass
   - analyze the uploaded image for subject, negative space, mood, composition, focal points
2. image generation pass
   - combine:
     - run data
     - split/song data
     - selected layout guidance
     - optional creative direction
     - image analysis notes

The prompt currently tries to:

- avoid app-like dashboards
- avoid adding a logo or app chrome
- preserve all songs instead of silently dropping them
- respect the chosen layout family

## Current Limitations

- output consistency is still weak
- Gemini may still compress, omit, or simplify some run/song information in the final image
- "music only" is better suited to a stable base-image-edit workflow than full generation from scratch
- some UI around layout choice is still being refined
- this branch should not be considered production-ready

## Recommended Next Direction

The likely best next step for this branch:

1. create a curated library of strong base images for music-only visuals
2. store metadata for them
   - style
   - density
   - ideal split count
   - ideal song density
3. let the user pick one or let the system auto-pick one
4. send that base image plus run/song data into Gemini as an edit job
5. keep the generated output constrained by the base composition

That should improve consistency much more than prompt tuning alone.

## Environment Variables

This branch expects:

- `GEMINI_API_KEY`

Optional overrides:

- `GEMINI_IMAGE_MODEL`
- `GEMINI_TEXT_MODEL`

These should stay server-side only.

## Deployment Note

This branch is intentionally separated from `main`.

Do not merge or deploy it to Vercel until:

- the UX is settled
- the prompting approach is stable
- the base-image strategy is implemented or rejected
- outputs are good enough to show users consistently

## If Another Chat Picks This Up

The most important context is:

- the main app is stable enough without Gemini
- Gemini is an experiment branch
- the user prefers creative, polished outputs over rigid dashboards
- the current generation-only approach feels too inconsistent
- the likely future is "base images + Gemini edit" for music-only artwork

If continuing work here, start by reviewing:

- [components/sync-panel.js](/Users/toni/Documents/pactune/components/sync-panel.js)
- [lib/gemini.js](/Users/toni/Documents/pactune/lib/gemini.js)
- [lib/layout-catalog.js](/Users/toni/Documents/pactune/lib/layout-catalog.js)
- [geminiprompt_layouts_v2.json](/Users/toni/Documents/pactune/geminiprompt_layouts_v2.json)
