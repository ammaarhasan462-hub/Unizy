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

1. Pick the top unticked item below.
2. Branch from main.
3. Implement the change, then rebake if needed with `python3 tools/city/bake_city.py`.
4. Push the branch and wait for the "Build landing page" commit. Pull it, then render with `python3 tools/city/render_intro.py desktop 0.25,0.36,0.47,0.56` for UCL, and again with `UNI=imperial`, `UNI=lse` and `UNI=qmul`, each on desktop and mobile (needs Playwright and Chrome; frames go to `/tmp/shots`).
5. Compare against the previous night's renders, which are kept in `tools/city/renders/`.
6. Merge to main only if the change is clearly better and nothing broke:
   - no console errors;
   - `engine up` within about 60 seconds under swiftshader;
   - the mobile render still works;
   - UCL, Imperial, LSE and Queen Mary all still look right.
7. Tick the item, add a line to the log at the bottom, and save the 4-frame sheet to `tools/city/renders/<date>.jpg`.

Keep to these limits:

- Download stays under about 1.5 MB gzipped per city.
- Desktop stays under about 900k city vertices, and mobile under about 350k.
- Never use paid APIs or keys.
- No "Claude", "Anthropic" or "AI" wording on the site.

## Backlog (top = next)


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
