# Intro realism: refinement backlog

The intros' cities are built from free sources only:

| Source | Licence | What it gives |
|---|---|---|
| OpenStreetMap, via the Geofabrik Greater London extract | ODbL; the intro shows "Map data © OpenStreetMap contributors" | Building footprints, heights and levels, streets, parks, water, rail and trees |
| Poly Haven textures | CC0 | Brick, render, stone, concrete and slate |

How the data flows:

1. `.github/workflows/fetch-city-pbf.yml` downloads the extract and writes `tools/city/raw/*.geojsonseq.gz`.
2. `tools/city/bake_city.py` turns those into `site/assets/city/<site>.json` and `site/assets/city/tex/`.
3. `web/components/intro/city.js` builds the geometry. It is called from `london.js` (UCL) and `southken.js` (Imperial).
4. If the data fails to load, the hand-built city is used instead.

The workflow runs monthly, so newly mapped buildings arrive on their own.

## How a refinement night works

1. Pick the top unticked item of the realism backlog, and the top unticked item of the lag backlog. Every night reduces lag as well as adding realism.
2. Branch from main.
3. Implement the changes, then rebake if needed with `python3 tools/city/bake_city.py`.
4. Render the before frames first, from a copy of `site/` and `render_intro.py`, because pulling a new build replaces `site/`.
5. Push the branch and wait for the "Build landing page" commit. Pull it, then render with `python3 tools/city/render_intro.py desktop 0.25,0.36,0.47,0.56` for UCL, and again with `UNI=imperial`, `UNI=lse` and `UNI=qmul`, each on desktop and mobile (needs Playwright and Chrome; frames go to `/tmp/shots`).
6. Read the lag numbers that `render_intro.py` prints for each run:
   - `engine up` time;
   - shader programs and vertices;
   - for each frame: ms between frames, draw calls and triangles.

   Under swiftshader, only the before → after change in these numbers means anything. Run the renders one at a time so the ms figures are not skewed.
7. Compare against the previous night's renders, which are kept in `tools/city/renders/`.
8. Merge to main only if the change is clearly better and nothing broke:
   - no console errors;
   - lag is lower, or at worst level within noise. No university or device may be clearly worse on engine up, ms per frame, draw calls or triangles. If a realism change adds lag, win it back the same night, for example with a cheaper far-distance path, a distance cut-off or fewer draw calls;
   - `engine up` within about 60 seconds under swiftshader;
   - the mobile render still works;
   - UCL, Imperial, LSE and Queen Mary all still look right.
9. Tick the items. Add a line to the log at the bottom with the before → after lag numbers for each university, and save the 4-frame sheet to `tools/city/renders/<date>.jpg`.

Keep to these limits:

- Download stays under about 1.5 MB gzipped per city.
- Desktop stays under about 900k city vertices, and mobile under about 350k.
- No lag regressions (see step 8).
- Never use paid APIs or keys.
- No "Claude", "Anthropic" or "AI" wording on the site.

## Lag backlog (top = next)

- [x] **One shader program for all four wall families.** They ran the same patched shader under four cache keys, so it compiled four times at start-up.
- [x] **Low-poly tree canopies far off.** Use a `THREE.LOD` per 400 m tile: 80-triangle lobes near, 20 beyond 650 m. The canopies were the largest share of each aerial frame's triangles.
- [x] **No interior draw calls from the air.** The furnished reading rooms and halls (about 500 small draw calls) are hidden until the camera is within 300 m.
- [ ] **One wall mesh per tile.** Put the four wall families in a texture array (or one atlas) so each 400 m tile is one wall draw instead of four. This cuts about 150–200 draw calls a frame.
- [ ] **Cheaper far facades.** Beyond about 600 m, use a stripped facade program: no interior mapping, dressings or shopfront code, only the averaged window colour. Use it as a second material per tile, through the same `THREE.LOD`.
- [ ] **Merge the interiors' furniture.** Merge the furniture (chairs, frames, lamp shades, gilt and so on) into a few instanced or merged meshes per material. Then the close-up shots draw tens of calls, not hundreds.
- [ ] **Look at the 116 shader programs.** List them (renderer.info.programs) and fold materials that differ only in colour or roughness into shared programs. Also check the 22 plain `onBeforeCompile` ones.
- [ ] **Railings and bay windows by distance.** Give them a `THREE.LOD` or a distance fade, so far tiles do not draw them at all.
- [ ] **Measure on a real GPU.** Swiftshader is CPU-bound. If a free GitHub Actions runner or a browser trace can give GPU frame times, add that to `render_intro.py`.

## Realism backlog (top = next)


- [x] **Shopfronts.** Put ground-floor shopfronts on high streets (Tottenham Court Road, Euston Road, Marchmont Street, Gloucester Road, Old Brompton Road):
  - use OSM `shop=*` and `amenity=*` nodes inside or next to a footprint to flag the building;
  - draw glazed fronts with fascia bands and warm interiors.
- [x] **Facade eras and dressings:**
  - Georgian stock brick with a rusticated stucco ground floor and black railings;
  - Victorian red brick with stone dressings and bay windows;
  - inter-war Portland stone;
  - 1960s concrete;
  - choose by `start_date`, `building:architecture` or `heritage`, then by street.
- [ ] **Heights for guessed buildings.** Fill buildings whose height was guessed (about 40% at UCL) using Environment Agency LiDAR. Use the National LIDAR Programme DSM minus the DTM, at 1 m, under the Open Government Licence; download it in CI from environment.data.gov.uk and take the median per footprint.
- [ ] **Roofs:**
  - mansards with dormers on terraces over 3 storeys;
  - parapets with copings;
  - roof terraces and plant on large flat roofs;
  - skylights;
  - lead-grey zinc on modern roofs.
- [ ] **The Thames.** Draw the real river from `river` in the baked data, and fit `riverX` (and the cloud shader's copy, `RIVER_GLSL`) to the real centreline. Add the bridges: Waterloo, Westminster and Vauxhall.
- [ ] **Trees:**
  - London plane silhouettes, taller and more open, with species from OSM `genus` / `species`;
  - more trees in Kensington Gardens and in the Bloomsbury squares;
  - within the vertex budget, using two instanced LODs.
- [ ] **Street furniture:** lamp columns, red buses on the main roads (in place of light streaks when the camera is low), and black cabs and bus shelters near UCL and Exhibition Road.
- [ ] **Imperial landmarks:**
  - check the shifted Natural History Museum and V&A against their real footprints;
  - extend the V&A to its real northern edge (x = -53);
  - model the Science Museum front on Exhibition Road.
- [ ] **Photo-scanned hero landmarks**, once the user sends scans. Accept Gaussian splats (`.ply` or `.spz`) from a free phone app such as Scaniverse, Luma or Polycam's free tier, of:
  - UCL's Portico;
  - the Main Quad;
  - the Queen's Tower;
  - the Royal Albert Hall.

  Render them with a three.js splat renderer installed in CI (for example `@sparkjsdev/spark` or `@mkkellogg/gaussian-splats-3d`). Blend them into the dawn grade, and fall back to the hand-built model.
- [ ] **Queen Mary and LSE:** bake `qmul` and `lse` (the raw data is already fetched), and give them keep-out rectangles once their hand-built campuses exist.
- [ ] **Mobile:** use a smaller radius, merge small buildings into blocks, and use a lower-resolution map texture. Test frame times.

## Log

- 2026-11-13: lag pass, at Ammaar's request (branch `city-perf-2026-11-13`). From now on every night reduces lag as well as adding realism; see the lag backlog and steps 4, 6 and 8.
  - `render_intro.py` now prints the lag numbers: engine up time, shader programs, vertices, and for each frame the ms between frames, draw calls and triangles.
  - Three changes, none of which shows in the frames:
    - the four wall families share one shader program;
    - tree canopies use 20-triangle lobes beyond 650 m, through a `THREE.LOD` per tile;
    - each campus's furnished interior is hidden until the camera is within 300 m of it.
  - Before → after at the intro frames. Swiftshader ms are only useful as a relative measure; on a real GPU they are much lower.

    | Desktop | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|
    | UCL | 20.0 → 8.1 s / 911 → 417 / 4.5 → 1.0M | 18.0 → 7.1 s / 786 → 292 / 3.9 → 0.9M | 18.9 → 16.1 s / 799 → 799 / 3.4 → 3.1M |
    | Imperial | 14.1 → 8.9 s / 824 → 637 / 3.1 → 1.1M | 12.5 → 9.3 s / 751 → 564 / 2.5 → 1.2M | 10.9 → 9.6 s / 609 → 609 / 2.0 → 1.5M |
    | LSE | 14.4 → 10.0 s / 566 → 475 / 2.8 → 1.1M | 12.4 → 8.8 s / 438 → 347 / 1.9 → 0.8M | 13.3 → 11.7 s / 363 → 363 / 1.6 → 1.0M |
    | Queen Mary | 15.7 → 8.5 s / 755 → 652 / 3.6 → 1.1M | 14.3 → 8.0 s / 599 → 496 / 3.1 → 1.1M | 12.0 → 10.4 s / 458 → 458 / 2.3 → 1.7M |

    | Mobile | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|
    | UCL | 2.4 → 1.3 s / 600 → 255 / 2.5 → 0.5M | 2.8 → 1.6 s / 544 → 200 / 2.3 → 0.5M | 3.0 → 3.0 s / 549 → 549 / 2.3 → 2.2M |
    | Imperial | 1.8 → 1.3 s / 646 → 459 / 1.3 → 0.5M | 1.7 → 1.4 s / 584 → 397 / 1.2 → 0.6M | 1.6 → 1.6 s / 489 → 489 / 1.1 → 1.0M |
    | LSE | 1.9 → 1.3 s / 357 → 266 / 1.1 → 0.4M | 1.8 → 1.3 s / 311 → 220 / 1.0 → 0.4M | 2.1 → 1.9 s / 274 → 274 / 0.8 → 0.7M |
    | Queen Mary | 1.6 → 1.1 s / 497 → 394 / 1.4 → 0.5M | 1.5 → 1.2 s / 434 → 331 / 1.3 → 0.5M | 1.6 → 1.6 s / 355 → 355 / 0.9 → 0.9M |

  - Engine up was within noise in the batch runs. Run alone and back to back, it was UCL 30 / 29 s → 28 / 29 s and Imperial 70 / 75 s → 68 / 67 s.
  - Checks:
    - no console errors at any of the four universities, on desktop or mobile;
    - the frames are unchanged;
    - the reading room (UCL) and the exam hall (Imperial) still render at 0.8;
    - the hand-built UCL fallback still works.
  - The 0.56 frames improve least, because the interior is already in range there. The next lag items (one wall mesh per tile, cheaper far facades, merged interior furniture) target exactly that.
  - Sheet: `renders/2026-11-13-lag.jpg`.

- 2026-11-12: facade periods are live (branch `city-refine-2026-11-12`).
  - `bake_city.py` gives every building a period, written as `e` in the city JSON: 0 as before, 1 Georgian and Regency, 2 Victorian, 3 inter-war Portland stone, 4 post-war concrete.
    - The period comes from the building's own `start_date`, `building:architecture` or `heritage` tags first. Only about 1% of buildings have these.
    - Next it comes from the street: `addr:street`, or else the nearest named road. Each site has a list of streets with a known period (Gower Street and Bedford Square, Queen's Gate, Lincoln's Inn Fields, Kingsway, Antill Road and so on). Streets not on the list take the most common period among their tagged buildings.
    - Otherwise the building's type decides: houses take the site's terrace period, tall flats are post-war.
    - Where OSM gives no wall material, the period now picks the walls, the same along a whole street. South Kensington is mostly stucco, Mile End mostly stock-brick Victorian, Harrington Gardens red brick.
    - Counts: UCL 7.4k Georgian, 1.8k Victorian, 0.5k stone, 0.8k post-war; Imperial 8.2k / 1.5k / 0.1k / 0.2k; LSE 6.6k / 1.7k / 0.7k / 0.8k; Queen Mary 0.2k / 7.4k / 0.1k / 0.7k.
  - The street fronts of the period terraces are written as `ef` (building, wall, kind).
  - `city.js` dresses the periods in the facade shader:
    - Georgian: rusticated stucco ground floors, a first-floor band and a cornice under the top storey, six-over-six sashes, tall first-floor windows with iron balconettes, front doors with fanlights;
    - Victorian: stone string courses, keyed window surrounds and two-over-two sashes, with quoins on whole buildings' corners;
    - Portland stone: banded rustication, ashlar courses, steel casements and a deep cornice;
    - post-war: ribbon windows, board-marked and rain-streaked spandrels, and a dark ground floor on columns.
  - New geometry:
    - black area railings with spear heads, with a gap at each door, over a dark basement area painted into the map. They blend into their average cover with distance, with no dither;
    - canted bay windows with lead roofs on Victorian houses, within 1.1 km on desktop and 0.5 km on mobile.
  - The first pass put quoins on every terrace house, so they read as white stripes. They now only go on the corners of whole buildings, and the stone dressings are toned down.
  - Results by university:
    - UCL: Gower Street and Bedford Square read as Georgian Bloomsbury;
    - Imperial: the Queen's Gate stucco has balconettes, and Harrington Gardens is red brick with bays;
    - LSE: Lincoln's Inn Fields reads as Georgian. Kingsway barely changes, because its mapped brick blocks keep their tagged material;
    - Queen Mary: the Mile End terraces have bay windows and doors.
    - From the intro's own camera path the change is small: South Kensington and Bloomsbury are a little creamier at street level.
  - Checks, before → after, at `render_intro`-style frames 0.25 / 0.36 / 0.47 / 0.56 plus street cameras:
    - no console errors at any of the four universities, on desktop or mobile;
    - engine up on desktop: UCL 35 → 41 s, Imperial 84 → 89 s, LSE 64 → 68 s, Queen Mary 63 → 69 s;
    - engine up on mobile: UCL 28 → 31 s, Imperial 63 → 76 s, LSE 46 → 51 s, Queen Mary 46 → 52 s. The longer facade shader takes longer to compile under swiftshader;
    - city JSON gzipped is 0.86 MB (UCL), 0.76 MB (Imperial), 1.03 MB (LSE) and 0.84 MB (Queen Mary);
    - city mesh vertices go up by 48k (UCL), 32k (Imperial), 36k (LSE) and 89k (Queen Mary) on desktop, and by 4k to 20k on mobile. All of these are under 5%.
    - Note: counted as every mesh with a `city*` material, instances included, the city was already about 2.0M vertices on desktop and 0.7M on mobile before tonight. That is over the 900k / 350k limits above, so the limits should be checked against how they were meant to be counted.
  - Fallback: UCL still drops to the hand-built city when `ucl.json` is missing. LSE without its JSON shows only the outer ring and the campus, which is how it was already, since it has no hand-built city.
  - Sheets: `renders/2026-11-12.jpg` (one after frame per university, at street level), `-pairs.jpg` (Bedford Square and Harrington Gardens, before and after), `-intro.jpg` (intro frames, before and after).
  - Next period ideas:
    - columned porches on Italianate stucco;
    - Edwardian terracotta and the red-brick mansion blocks;
    - mews;
    - polychrome Victorian brick.

- 2026-11-11: shopfronts are live (finishes the unmerged attempt on `city-refine-2026-11-10`).
  - The extract now carries shop, cafe, pub and bank nodes (about 5k at UCL, 3k at Imperial). `bake_city.py` flags each street-facing ground-floor wall they sit on, plus unmapped units between two shops on the same parade, and writes them as `sf` in the city JSON: 4,987 walls at UCL, 1,685 at Imperial (QMUL and LSE get them too).
  - A wall only counts if the walk out to the street is clear, so kiosks, arcades and the next block across a yard no longer hide shopfronts behind them.
  - `city.js` draws them in the facade shader, with no new vertices. Each unit has pilasters, a painted fascia with lettering (pubs get gilt), a cornice, a stallriser, a door and the display glass. Behind the glass is a lit shop floor with stock on the shelves, a dark unit, or a roller shutter still down at dawn. Shop light also spills onto the pavement.
  - The interiors are toned to dawn after the first pass came out blown-out white.
  - Checks:
    - no console errors;
    - engine up in 49 to 55 s for UCL. Imperial desktop takes 93 to 98 s; it took 88 s before this change, so it was already over the 60 s target under swiftshader;
    - mobile still renders, with the engine up in 30 s (UCL) and 44 s (Imperial);
    - city JSON is 0.82 MB (UCL) and 0.72 MB (Imperial) gzipped;
    - the hand-built fallback still works.
  - From the intro's own camera path the change is small, because the campus streets carry few shops. It is clear at street level: see `renders/2026-11-11.jpg` (street close-ups, before and after).
  - Next shopfront ideas: awnings on cafes, hanging pub signs, and A-boards.
- 2026-11-10 (late): photoreal pass is live.
  - Rooms behind every window (interior mapping), with curtains, reveals, sills and lintels.
  - Scanned CC0 furniture from Poly Haven, listed in tools/assets/want.txt and fetched by fetch-assets.yml:
    - UCL reading room: chairs, chandeliers, busts, paintings, encyclopaedias and spectacles;
    - Imperial exam hall: stacking chairs.
  - Oak, mahogany, panelled plaster, a worn runner, veined marble, old glass, an interior HDRI, contact shadows and lamp pools.
  - Scanned ashlar on the Wilkins Building and the Queen's Tower.
  - Stand-in figures removed.
  - Next interior ideas: fluted marble columns with capitals, and more shelving on the end wall.
- 2026-11-10: Real OSM cities live for UCL and Imperial. They have:
  - 13.6k (UCL) and 11.3k (Imperial) buildings;
  - the real streets, parks and water;
  - 3.8k and 2.8k mapped trees;
  - CC0 textures;
  - a monthly data refresh.
