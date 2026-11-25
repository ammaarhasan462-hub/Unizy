# Intro realism: refinement backlog

The intros' cities are built from free sources only:

| Source | Licence | What it gives |
|---|---|---|
| OpenStreetMap, via the Geofabrik Greater London extract | ODbL; the intro shows "Map data © OpenStreetMap contributors" | Building footprints, heights and levels, streets, parks, water, rail and trees |
| Poly Haven textures | CC0 | Brick, render, stone, concrete and slate |
| Environment Agency LiDAR Composite DSM and DTM, 1 m (2022) | Open Government Licence v3.0; the intro credits "Heights © Environment Agency LiDAR (OGL)" | Heights of the buildings that OSM has no height or levels for |

How the data flows:

1. `.github/workflows/fetch-city-pbf.yml` downloads the extract and writes `tools/city/raw/*.geojsonseq.gz`. The skyline extract (`skyline.geojsonseq.gz`) also carries the river surfaces (`water=river`) and the named bridges for the Thames and its bridges.
2. `.github/workflows/fetch-city-lidar.yml` runs `tools/city/lidar_heights.py` (needs numpy, tifffile, imagecodecs and pyproj, so CI only). It downloads the 5 km LiDAR tiles over each site from the survey download API, takes the last-return DSM minus the DTM, and writes the median height above ground under every footprint to `tools/city/raw/<site>.lidar.json.gz`. It runs monthly, the day after the extract.
3. `tools/city/bake_city.py` turns those into `site/assets/city/<site>.json` and `site/assets/city/tex/`.
   - The docks and basins beyond the 3 km map (`od`) also come from the skyline extract (`outer_docks` in `bake_city.py`), out to 7 km.
4. `web/components/intro/city.js` builds the geometry. It is called from `london.js` (UCL), `southken.js` (Imperial) and `cityworld.js` (Queen Mary, LSE and King's).
   - King's (`kcl`, the Strand) has no extract of its own: `bake_city.py` reads LSE's raw files for it (`raw` in `SITES`), centred on the King's Building. Its hand-built campus is `kcl.js`: the King's Building's river front and the Great Hall.
5. If the data fails to load, the hand-built city is used instead.

The workflow runs monthly, so newly mapped buildings arrive on their own.

## How a refinement night works

1. Pick the top unticked item of the realism backlog, and the top unticked item of the lag backlog. Every night reduces lag as well as adding realism.
2. Branch from main.
3. Implement the changes, then rebake if needed with `python3 tools/city/bake_city.py`.
4. Render the before frames first, from a copy of `site/` and `render_intro.py`, because pulling a new build replaces `site/`.
5. Push the branch and wait for the "Build landing page" commit. Pull it, then render with `python3 tools/city/render_intro.py desktop 0.25,0.36,0.47,0.56` for UCL, and again with `UNI=imperial`, `UNI=lse`, `UNI=qmul` and `UNI=kcl`, each on desktop and mobile (needs Playwright and Chrome; frames go to `/tmp/shots`).
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
   - UCL, Imperial, LSE, Queen Mary and King's all still look right.
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
- [x] **One wall mesh per tile.** Put the four wall families in a texture array (or one atlas) so each 400 m tile is one wall draw instead of four. This cuts about 150–200 draw calls a frame.
- [x] **Cheaper far facades.** Beyond about 600 m, use a stripped facade program: no interior mapping, dressings or shopfront code, only the averaged window colour. Use it as a second material per tile, through the same `THREE.LOD`.
- [x] **Merge the landmarks and the water.** St Paul's, the BT Tower, the London Eye, the Albert Memorial, the Royal Albert Hall, the Natural History Museum and the V&A are merged per material (`mergeStatic` in `materials.js`; facade boxes stay as they are, because their windows come from each box's scale). The map's water areas and the river are one mesh. Boxes on the ground or on a roof have no bottom face (`groundBox`).
- [x] **Merge the interiors' furniture.** Merge the furniture (chairs, frames, lamp shades, gilt and so on) into a few instanced or merged meshes per material. Then the close-up shots draw tens of calls, not hundreds. (`mergeInterior` in `materials.js`, called from `engine.js`: every static part of each university's interior, one mesh per material. The scanned furniture was already instanced; the parts that move or get swapped, and UCL's `wood` parts that the upgrade picks out by size, stay apart.)
- [x] **Look at the 116 shader programs.** List them (renderer.info.programs) and fold materials that differ only in colour or roughness into shared programs. Also check the 22 plain `onBeforeCompile` ones. (Done 2026-11-21: `atmo()` keys a program by its shader code, not the material's name. Every unpatched material shares the haze program for its feature set, and the facades, foliage and triplanar surfaces share one program per patch family (`userData.prog`). Start-up programs fell from 86–151 to 43–49. `PROGS=1 render_intro.py` lists them.)
- [x] **The remaining programs.** About 32 of the 43–49 at start-up carry no haze key: the post-processing passes, the sky and cloud shaders, the shadow-depth variants and the unlit lamp materials. List them by cache key and see which variants (instancing, vertex colours, alpha test) can be shared or dropped. The `-ash` keys in `realism.js` and the city's `cityf` variants are separate patches and stay. (Done 2026-11-24: listed by cache key (`PROGS=file.json` in a copy of `render_intro.py` dumps `[name, cacheKey]`). Two were waste: the cloud shader, the heaviest, was compiled a second time for the screen before the picker though it is only drawn into `cloudRT`; and the interior's reflection was set on unlit `MeshBasicMaterial`s (bulbs, flames, shafts), so each compiled a second program mid-scroll (and was dimmed by it). Both gone: start-up 43–48 → 42–47, end of run 56–73 → 54–67. The rest are distinct: the post chain (GTAO, bloom's high pass, five blur kernel sizes and composite, output, grade), the sky's background, the two traffic shaders, six shadow-depth variants (instanced or not, instance colours, alpha-tested maps, side) and the unlit variants (instanced, vertex colours, transparent, mapped). Sharing those would change how things look.)
- [ ] **Railings by distance.** The railings are still one city-wide mesh. Split them by tile into the wall `THREE.LOD`'s near level (no extra draw: merge them into a mesh that is already drawn, or accept the draw only on near tiles), so far tiles do not draw them at all. Bay windows are done: they are detail triangles that far tiles skip.
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
- [x] **Heights for guessed buildings.** Fill buildings whose height was guessed (about 40% at UCL) using Environment Agency LiDAR. Use the National LIDAR Programme DSM minus the DTM, at 1 m, under the Open Government Licence; download it in CI from environment.data.gov.uk and take the median per footprint.
- [x] **Roofs:**
  - mansards with dormers on terraces over 3 storeys;
  - parapets with copings;
  - roof terraces and plant on large flat roofs;
  - skylights;
  - lead-grey zinc on modern roofs.
- [x] **The Thames.** Draw the real river from `river` in the baked data, and fit `riverX` (and the cloud shader's copy, `RIVER_GLSL`) to the real centreline. Add the bridges: Waterloo, Westminster and Vauxhall.
- [x] **The Thames, part 2:**
  - the tide: the river sits flush with the streets, so the bridges ramp down to meet it. Lower the water by about 4 m and draw the Embankment's granite river walls (and the South Bank's), so the decks run level onto the banks;
  - boats: the moored barges and the river buses, and the lit pleasure boats along the Embankment;
  - Westminster's lamps and Albert Bridge's lights strung along its chains;
  - (done 2026-11-19: the water 4.5 m down between granite walls, the Embankment's lamps and festoons, moored and moving boats, the suspension bridges' bulbs. The rest is split into part 3.)
- [x] **The Thames, part 3:**
  - the docks (`water=dock`) and the Lea's outlines round Queen Mary: bake them with the river so they are lowered and walled too (needs `bake_city.py` and a refetch);
  - (done 2026-11-21: the canals, locks, docks and basins inside each map are set below their towpaths and quays between walls, with narrowboats and decks where streets cross. No refetch was needed: the site extracts already carry them. The Lea's tidal outlines were already lowered with the river. The rest is split into part 4.)
- [x] **The Thames, part 4:**
  - the docks and basins beyond the 3 km map (Limehouse Basin, Shadwell Basin and the West India Docks at Queen Mary, City Road Basin at LSE, the Regent's Canal at King's Cross for UCL): draw them in the outer ring, lowered and walled like the river;
  - (done 2026-11-24: the docks and basins beyond the map, from the skyline extract, at all five universities. The skyline extract now also keeps the piers and moorings, ready for part 5. The rest is split into part 5.)
- [ ] **The Thames, part 5:**
  - moor the boats at the real piers (OSM `man_made=pier`: Westminster, Embankment, Festival, Bankside, Tower) and the mapped houseboat moorings at Chelsea, in place of the procedural spacing. The skyline extract has them since 2026-11-24 (505 piers and jetties, 196 moorings); `bake_city.py` must write the river piers near each site (for example as `pr`), and `bridges.js` moor along them;
  - the foreshore at low tide: the shingle beaches below the walls at Bankside and Queenhithe;
  - Westminster Bridge's triple-lantern lamp standards, and the dolphin lamps' shape on the Victoria Embankment;
  - narrowboats with chimneys, roof clutter (bikes, plants, solar panels) and the towpath's moorings rings, close up;
  - the canals' narrow runs beyond the map (the Regent's Canal past King's Cross and Islington, the Limehouse Cut, the Grand Union to Paddington): too thin for the far ground's holes; perhaps as dark strips on the far ground's texture, with the outer city kept off them by a narrower margin than the river's 50 m.
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

- 2026-11-24 (night, branch `city-refine-2026-11-24`): the docks and basins beyond the map, lowered and walled, with boats; two wasted shader programs gone; the far river thinned.
  - Realism: the Thames, part 4 (its first item; the rest is split into part 5).
    - The skyline extract (`fetch-city-pbf.yml`, `pbf_filter.py`) now also keeps docks, harbours, marinas and named dock and canal basins (Limehouse Basin and City Road Basin are mapped as `water=canal`), and the piers, jetties and moorings (505 and 196), ready for part 5.
    - `bake_city.py` writes `od`: the docks and basins wholly outside each 3 km map, out to 7 km, simplified to 5 m (UCL 24, Imperial 6, LSE 21, Queen Mary 27, King's 21).
    - `city.js`: each is drawn in 1.5 m over its water (so neighbours that meet, like Millwall's inner and outer docks, keep a quay between them), kept clear of the river, set 1.7 m down like the map's own docks, cut out of the far ground, and painted into the river mask: the outer city's blocks no longer stand in them, and the cloud stage shows them as water. If the far ground cannot be cut round them they are left out.
    - `bridges.js`: their walls (one face, out to 2.2 km; 1.6 km on mobile) and cruisers, houseboats and lighters moored along the larger ones' quays (out to 3 km; 2 km on mobile). All in the bridges' mesh: no new draw call.
  - Results by university (`renders/2026-11-24.jpg`, `-pairs.jpg`):
    - Queen Mary: the clearest change. The West India and Millwall Docks wrap Canary Wharf's towers, Limehouse and Shadwell basins open between the outer blocks, and in the cloud stage the Isle of Dogs shows its docks as water instead of a solid grid of lit streets.
    - LSE and King's: St Katharine Docks, the Surrey docks and City Road Basin are water now, 2 to 7 km off; small from the intro's frames.
    - UCL: the same docks far to the east, and the basins by King's Cross beyond the map's edge; small.
    - Imperial: Chelsea Harbour and Paddington Basin; small.
    - The intro's own frames at 0.36 to 0.56 barely change anywhere (the docks are beyond the map); the outer city's random blocks reshuffle a little where they now skip the docks.
  - Lag: the remaining-programs item (backlog), plus measured cuts that pay for the docks.
    - The cloud shader, the heaviest, was compiled a second time for the screen before the picker (it is only drawn into `cloudRT`); now it is compiled for its target. The interior's reflection is no longer set on unlit materials (bulbs, flames, light shafts), which each compiled a second program mid-scroll. Programs at start-up 43–48 → 42–47 at every university and device (UCL mobile read 65 at start-up in two after runs: its furniture had already loaded; 72 → 67 at the end); at the end of a run 56–73 → 54–67.
    - The Thames' banks beyond 4 km are thinned to 7 m in the bake (`thin_far`), keeping a stretch whole wherever thinning would make any bank cross another (checked on the decimetre grid; no new crossings): river points UCL 2321 → 1941, Imperial 2414 → 1971, LSE 2100 → 1829, Queen Mary 1919 → 1539, King's 2101 → 1838, so fewer far-ground, water and wall triangles. The Thames' far walls stop at 5.5 km (they were drawn to 6.5 km, about a pixel tall there), and its boats at 4 km (2.7 km on mobile), about six pixels long beyond.
    - The outer docks skip the road-crossing and meeting checks, and the river mask is one blurred fill, so the build does less work.
  - Before → after, interleaved runs (before, then after, for each university and device, 01:2x to 02:0x; `exact.py` prints triangles to 4 decimals). Ms are swiftshader ms between frames, so only the change counts.

    | Desktop | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 28 → 24 s | 1166 → 1167 / 237 → 237 / 0.715 → 0.715M | 900 → 883 / 202 → 202 / 0.828 → 0.828M | 1850 → 1850 / 646 → 646 / 2.990 → 2.990M |
    | Imperial | 30 → 32 s | 1367 → 1317 / 381 → 381 / 0.857 → 0.855M | 1583 → 1533 / 359 → 359 / 1.098 → 1.096M | 1183 → 1167 / 479 → 479 / 1.391 → 1.389M |
    | LSE | 25 → 27 s | 1250 → 1267 / 259 → 259 / 0.770 → 0.769M | 1250 → 1267 / 216 → 216 / 0.629 → 0.629M | 1200 → 1167 / 268 → 268 / 0.955 → 0.955M |
    | Queen Mary | 25 → 24 s | 1083 → 1200 / 365 → 365 / 0.643 → 0.643M | 1117 → 1183 / 315 → 315 / 0.816 → 0.816M | 1383 → 1517 / 360 → 360 / 1.626 → 1.626M |
    | King's | 28 → 22 s | 1183 → 1417 / 253 → 253 / 0.755 → 0.755M | 1167 → 1100 / 224 → 224 / 0.556 → 0.554M | 1117 → 1483 / 300 → 300 / 0.792 → 0.792M |

    | Mobile | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 6.7 → 7.2 s | 117 → 117 / 180 → 180 / 0.468 → 0.467M | 150 → 117 / 165 → 165 / 0.509 → 0.508M | 367 → 383 / 451 → 451 / 2.242 → 2.241M |
    | Imperial | 10.8 → 10.6 s | 117 → 100 / 308 → 308 / 0.410 → 0.409M | 117 → 133 / 288 → 288 / 0.541 → 0.539M | 183 → 167 / 422 → 422 / 0.976 → 0.975M |
    | LSE | 9.9 → 10.7 s | 100 → 100 / 186 → 186 / 0.349 → 0.348M | 100 → 100 / 170 → 170 / 0.393 → 0.393M | 133 → 117 / 229 → 229 / 0.730 → 0.730M |
    | Queen Mary | 9.4 → 10.1 s | 100 → 100 / 264 → 264 / 0.338 → 0.337M | 100 → 83 / 248 → 248 / 0.393 → 0.393M | 150 → 167 / 315 → 315 / 0.863 → 0.852M |
    | King's | 9.2 → 9.4 s | 100 → 100 / 191 → 191 / 0.373 → 0.373M | 100 → 100 / 177 → 177 / 0.334 → 0.334M | 133 → 133 / 262 → 262 / 0.576 → 0.576M |

  - Repeats where the batch read up (the last two builds change only build-time work, not the frames):
    - King's desktop, five pairs in both orders: 0.36 at 1350 → 1403 ms on average, 0.47 at 1190 → 1216 ms, 0.56 at 1363 → 1470 ms, but the spread is 1117–1550 ms either way and the two in reverse order (after first) read 1367 / 1166 / 1550 and 1383 / 1433 / 1450 against 1417 / 1383 / 1483 and 1367 / 1150 / 1433. A per-material count of King's 0.56 frame: the same draws and 70 fewer triangles (bridges +19, water -69, outer blocks -70). Level within noise.
    - Queen Mary desktop, two pairs: 0.36 at 1183 / 1267 → 1267 / 1183 ms, 0.47 at 1333 / 1433 → 1350 / 1367 ms, 0.56 at 1417 / 1450 → 1483 / 1400 ms. Level.
    - Engine up, four runs each (before, after, after, before) on the final build: Queen Mary mobile 10.4 → 10.7 s, LSE mobile 9.8 → 9.9 s, UCL mobile 6.2 → 6.2 s, Imperial desktop 31.5 → 27.4 s, LSE desktop 25.3 → 28.9 s (other batches tonight read LSE desktop 40.7 → 35.2 s and 33.8 → 27.6 s). Queen Mary mobile is the one that leans up, by about 0.3 s (3%) across eleven runs, inside its 9.4–11.1 s spread; desktop engine up moves by ±5 s run to run.
    - So: draw calls level everywhere; triangles lower or level everywhere (by up to 0.011M, Queen Mary mobile 0.56); programs one fewer at start-up and 1–6 fewer at the end everywhere; ms per frame and engine up level within noise.
  - Size: city JSON gzipped 0.77 to 1.04 MB (-2.2 KB to +0.1 KB: `od` added, `rv` thinned). City vertices -0.2% to +0.04% (desktop 2.54M to 2.74M, mobile 0.83M to 0.89M).
  - Checks:
    - no console errors at any of the five universities, on desktop or mobile (only the usual parallel-compile warning);
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404; the hand-built city renders, and skipping removes the intro).
  - The site extracts on the branch are main's (restored after each fetch and rebaked locally, bake commits `[skip ci]`); only the skyline extract is new. Merging changes `bake_city.py` and the fetch workflow on main, which re-runs the fetch there and brings the refreshed site extracts (and the usual park-tree reshuffle), as the monthly refresh would.
  - Sheets: `renders/2026-11-24.jpg` (Queen Mary's docks from the air and in the cloud stage, and one intro frame for UCL, Imperial, LSE and King's), `-pairs.jpg` (Queen Mary's Canary Wharf, cloud stage and Limehouse, LSE towards St Katharine Docks, Imperial's Chelsea Harbour, before and after).
  - Next:
    - "The Thames, part 5": boats moored at the real piers (the data is in the skyline extract now), the foreshore, Westminster's lamps, the canals' narrow runs beyond the map;
    - "Railings by distance" is now the top lag item.

- 2026-11-23 (day, branch `perf-smooth`, at Ammaar's request: "decrease the lag on mobile and on laptop, in the intro and on the homepage"): a lag pass on the homepage and the intro.
  - Homepage (phones skip the intro, so this is what they get):
    - framer-motion is gone from the homepage: reveal-on-scroll, magnetic buttons, the nav and the FAQ are CSS transitions with one shared IntersectionObserver (`ui.jsx`, `globals.css`). Homepage JS 712 → 586 KB; blocking time while loading on a phone (4× CPU throttle) about 400 → about 230 ms.
    - The scroll story (`story.js`) measures its sections' positions once (again on resize, content change, fonts loading, or each second) and its frame never reads layout. Main-thread time while scrolling the whole page on a laptop 1010–1070 → 745–785 ms; script 135–140 → 92–106 ms.
    - The story's pattern layers are half the size (as big as their movement needs), and the glass cards have no live backdrop blur (it was redrawn for every card on every scroll frame; the page behind them is already very soft).
    - The page under the intro is not painted while the intro covers it (`html.intro-live`), and the story's frame does nothing then; it is shown again as the intro starts to fade (`intro-out`).
  - Intro (laptops):
    - Adaptive quality judges every 30 frames, steps twice when most frames are very slow, and has a fourth, lower-resolution step. Under swiftshader (desktop, before → after, interleaved): UCL 0.47 at 1483 → 967 ms, 0.56 at 2783 → 2066 ms; Imperial 0.56 at 1750 → 1233 ms; Queen Mary 0.56 at 2033 → 1467 ms; King's 0.56 at 1850 → 1217 ms; LSE 0.56 at 2083 → 1950 ms. Draw calls and triangles unchanged; engine up level within noise.
    - No live backdrop blur on the picker cards, skip button and end card (each was re-blurred over the moving canvas every frame), and no CSS grain layer over the canvas (the engine's grade already adds grain; a full-screen blend layer was composited every frame).
  - Checks: no console errors (homepage on phone and laptop; intro at all five universities); the homepage looks the same at every scroll position on both; the FAQ opens and closes; every reveal fires; skipping the intro shows the page.

- 2026-11-21 (night, branch `city-refine-2026-11-21`): the canals and docks set below their towpaths between walls, with narrowboats; shader programs shared; the far ground no longer drawn under the map.
  - Realism: the Thames, part 3 (its first item; the rest is split into part 4).
    - `bake_city.py` flags the impounded water as `dk` (map area index, level): 1 for canals and locks (`water=canal|lock`), 2 for docks and basins (`waterway=dock`, `water=dock|harbour|marina`, and named `water=basin` such as Battlebridge Basin; unnamed basins are fountains and park ponds and stay flush). No refetch: the site extracts already carry them. The rest of the JSON is unchanged.
    - `city.js`: each one inside the map (clipped to it, clear of the river) is set down, canals 0.95 m and docks 1.7 m. It is cut from the map's ground alpha like the river at LSE and King's, its outline set 0.5 m out over the water so the ground always laps the wall. The far ground is cut round the map's square where the river stays clear of it (so it is never drawn under the map), else round the docks.
    - `bridges.js`: the walls, one face each, dark and wet at the water and clearing upward to stock brick (canals) or granite (docks), with a pale coping within 1 km (600 m on mobile); no wall where two pieces at the same level meet. Narrowboats (15–21 m, a black hull, a long painted cabin, some lit) moored along both banks within 1.3 km (800 m on mobile). Where a road or railway crosses, a deck at street level with its fascia and brick parapets. All in the bridges' mesh: no new draw call.
    - Queen Mary has 13 pieces in its map (the Regent's Canal past Mile End, the Hertford Union, the Lee Navigation's cuts and their locks), UCL 2 (the canal and basin by King's Cross, at the map's edge). Imperial, LSE and King's have none inside their maps; Limehouse, Shadwell and City Road basins are beyond the 3 km maps (part 4).
  - Results by university (`renders/2026-11-21.jpg`, `-pairs.jpg`):
    - Queen Mary: the clearest change. The Regent's Canal is a channel below its towpaths, brick walls catching the dawn along the bank, narrowboats moored nose to tail, and Mile End's road crossing on a deck. From the intro's own frames it shows as a darker, sharper channel past the campus.
    - UCL: the canal by King's Cross sits below its towpath; it is at the map's edge, so small in the intro.
    - Imperial, LSE and King's: unchanged to the eye (their lag changes below).
  - Lag: the shader-programs item (backlog), plus the far ground and some triangles.
    - `atmo()` now keys each program by its shader code rather than the material's name: unpatched materials share the haze program for their feature set, and the facades, foliage and triplanar surfaces share one program per patch family (`userData.prog`). Programs at start-up: UCL 118 → 44, Imperial 151 → 49, LSE 93 → 48, Queen Mary 91 → 46, King's 86 → 43; at the end of a run 203 → 73, 163 → 60, 102 → 56, 133 → 69, 125 → 63. That is where engine up falls, most on mobile.
    - The far ground (`farGeo`) has the map's square cut out where the river stays clear of the map (UCL, Imperial, Queen Mary), so it is not shaded under the map at all. A first version triangulated the map's ground round the docks; under MSAA its many triangles cost Queen Mary desktop about 15% a frame, so the docks are cut from the ground's alpha instead. A second version drew the far ground first without depth and with no holes; that cost every mobile run 15–25%, and was dropped.
    - Boat decks and Tower Bridge's roofs are real triangles, not quads with a degenerate half; the Thames' copings stop at 3.5 km and its walls at 6.5 km (under a pixel beyond); far tree canopies thin out from 1.1 km instead of 1.25 km. These pay for the canals' walls and boats.
    - `render_intro.py`: `SHOTS=dir` for the frames, `PROGS=1` lists the programs, and it prints how the docks were cut.
  - Before → after, batch runs (before at the start of the night from a copy of main's site, after at the end; Imperial's after row is from the final build, the others from the batch just before a bake change that only dropped Imperial's park ponds and some unnamed basins outside Queen Mary's map). Ms are swiftshader ms between frames, so only the change counts.

    | Desktop | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 38 → 37 s | 2200 → 1933 / 237 → 237 / 0.73 → 0.71M | 2250 → 1933 / 202 → 202 / 0.84 → 0.83M | 3783 → 3550 / 646 → 646 / 3.00 → 2.99M |
    | Imperial | 54 → 40 s | 2417 → 2117 / 381 → 381 / 0.88 → 0.86M | 2617 → 2483 / 359 → 359 / 1.11 → 1.10M | 2533 → 2383 / 479 → 479 / 1.42 → 1.39M |
    | LSE | 38 → 39 s | 2117 → 2116 / 259 → 259 / 0.79 → 0.77M | 2083 → 2083 / 216 → 216 / 0.64 → 0.63M | 2500 → 2500 / 268 → 268 / 0.96 → 0.96M |
    | Queen Mary | 37 → 29 s | 1933 → 1666 / 365 → 365 / 0.64 → 0.64M | 2067 → 1850 / 315 → 315 / 0.83 → 0.82M | 2700 → 2400 / 361 → 361 / 1.64 → 1.63M |
    | King's | 38 → 33 s | 1983 → 1967 / 253 → 253 / 0.77 → 0.75M | 1900 → 1966 / 224 → 224 / 0.57 → 0.56M | 2317 → 2333 / 299 → 299 / 0.80 → 0.79M |

    | Mobile | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 12.6 → 7.8 s | 233 → 217 / 178 → 178 / 0.47 → 0.47M | 217 → 250 / 165 → 165 / 0.51 → 0.51M | 516 → 483 / 451 → 451 / 2.25 → 2.24M |
    | Imperial | 19.0 → 11.8 s | 200 → 217 / 308 → 308 / 0.42 → 0.41M | 217 → 250 / 288 → 288 / 0.55 → 0.54M | 283 → 267 / 422 → 422 / 0.98 → 0.98M |
    | LSE | 12.7 → 10.5 s | 200 → 217 / 188 → 186 / 0.36 → 0.35M | 200 → 183 / 170 → 170 / 0.40 → 0.39M | 233 → 267 / 229 → 229 / 0.73 → 0.73M |
    | Queen Mary | 13.6 → 10.9 s | 200 → 217 / 264 → 264 / 0.34 → 0.34M | 200 → 167 / 248 → 248 / 0.40 → 0.39M | 284 → 250 / 316 → 315 / 0.87 → 0.85M |
    | King's | 12.8 → 11.0 s | 217 → 217 / 191 → 191 / 0.38 → 0.37M | 200 → 300 / 177 → 177 / 0.35 → 0.34M | 233 → 350 / 262 → 262 / 0.58 → 0.58M |

  - Interleaved runs (before, after, before, after) where the batch showed ms up, all on the final far-ground and alpha-cut build:
    - King's mobile: 0.36 at 233 / 217 → 217 / 233 ms; 0.47 at 300 / 250 → 267 / 217 ms; 0.56 at 316 / 267 → 233 / 283 ms (the batch's 300 / 350 was a hiccup); engine up 14.2 / 12.5 → 11.0 / 11.4 s.
    - UCL mobile: 0.36 at 250 → 233 ms; 0.47 at 267 → 267 ms; 0.56 at 567 → 550 ms; engine up 12.4 → 8.0 s.
    - Imperial mobile: 0.36 at 233 → 233 ms; 0.47 at 267 → 250 ms; 0.56 at 317 → 283 ms; engine up 19.7 → 12.4 s.
    - LSE mobile: 0.36 at 233 → 217 ms; 0.47 at 250 → 217 ms; 0.56 at 217 → 217 ms.
    - Queen Mary desktop: 0.36 at 1817 → 1667 ms; 0.47 at 2700 → 1983 ms; 0.56 at 2700 → 2433 ms; engine up 38.9 → 32.4 s.
    - Imperial desktop: 0.36 at 2500 → 2250 ms; 0.47 at 2850 → 2600 ms; 0.56 at 2583 → 2450 ms; engine up 57.0 → 50.4 s.
    - UCL desktop: 0.36 at 2233 → 1983 ms; 0.47 at 2300 → 1950 ms; 0.56 at 3883 → 3683 ms.
    - So ms per frame is lower or level within noise everywhere (mobile frames are rAF-quantised at about 17 ms); engine up is lower everywhere but LSE desktop (level, 38 → 39 s, within the ±10 s noise). Draw calls level (UCL mobile at 0.36 reads 180 in some after runs, +2); triangles lower or level everywhere, by up to 0.03M.
  - Size: city JSON gzipped +17 to +108 bytes (`dk`). City vertices -0.3% (UCL, Imperial, LSE, King's) and +0.3% (Queen Mary, the canals) on desktop; -1% / +0.4% on mobile (desktop 2.54M to 2.74M, mobile 0.83M to 0.89M).
  - Checks:
    - no console errors at any of the five universities, on desktop or mobile;
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404; the frames match main's fallback. The skip check reads before the fade ends under swiftshader, on main's build too).
  - The bake commits were pushed with `[skip ci]`, so the branch kept main's extracts. Merging this into main changes `bake_city.py` there, which re-runs the fetch and brings the refreshed extracts (and the usual park-tree reshuffle), as the monthly refresh would.
  - Sheets: `renders/2026-11-21.jpg` (one after frame per university: the canals at Queen Mary and UCL close up, Imperial, LSE and King's at 0.47), `-pairs.jpg` (Queen Mary's canal, Mile End and UCL's canal, before and after).
  - Next:
    - "The Thames, part 4": the docks beyond the map (Limehouse and Shadwell basins at Queen Mary, City Road Basin at LSE) in the outer ring, boats at the real piers (needs `man_made=pier` in the extract), the foreshore, Westminster's lamps;
    - "The remaining programs" is now the top lag item.

- 2026-11-20 (day, branch `intro-fast-load`, at Ammaar's request: "the loading takes ages"): the intro starts in the clouds at once and the city is built behind them.
  - Before, every university's world (city, campus, shaders, buffers) was built in one go before the first frame. The picker took 8.5–13.5 s to appear under swiftshader, behind a 7–10 s freeze. Picking anything but UCL threw that world away and froze the page again for 5–14 s before the intro started.
  - Now:
    - the engine starts with the sky and clouds only, without waiting for the map to download;
    - `buildCityGen` and the world builders (`buildLondonGen`, `buildSouthKenGen`, `buildCityWorldGen`) yield between slices. The engine runs them in slices of 10–14 ms (three times a frame's cost where frames are slow, capped at 160–260 ms), then compiles the shaders and uploads the buffers a few objects at a time, then shows the world (`state.worldReady`);
    - while the world is being built, slow frames draw the clouds at half rate;
    - scrolling waits halfway down the cloud deck (with a small "Building the city" line) only if the city is not ready yet. While it waits, the clouds are drawn a few times a second;
    - a university's map is fetched as soon as its card is hovered, focused or touched, and at once on a pick. The blind Imperial prefetch behind the picker is gone;
    - the photo-scanned interior is fetched only after a pick, once the world is built;
    - the hand-built fallback still works (and is streamed too). The cloud shader then has no river under the clouds.
  - Loading under swiftshader, before → after (`load.py`: page load to the first frame, which is when the picker appears; pick to the intro starting; pick to the city shown; the longest main-thread freeze after the pick):

    | | picker appears | pick → intro starts | pick → city shown | longest freeze after pick |
    |---|---|---|---|---|
    | UCL desktop | 13.5 → 2.5 s | 1.6 → 1.7 s | 1.6 → 26.0 s (it was built behind the picker before) | 0.6 → 1.5 s |
    | UCL mobile | 8.9 → 1.2 s | 0.6 → 0.8 s | 0.6 → 7.1 s | 0.1 → 1.5 s |
    | Imperial desktop | 12.6 → 2.4 s | 25.0 → 2.6 s | 25.7 → 30.7 s | 14.5 → 2.1 s |
    | Imperial mobile | 8.8 → 1.1 s | 13.4 → 1.6 s | 13.5 → 12.1 s | 11.5 → 1.9 s |
    | LSE desktop | 13.0 → 2.4 s | 12.7 → 3.2 s | 13.7 → 18.3 s | 7.6 → 1.1 s |
    | LSE mobile | 8.5 → 1.1 s | 7.7 → 1.5 s | 7.8 → 7.8 s | 5.8 → 0.8 s |
    | Queen Mary desktop | 12.1 → 2.6 s | 16.4 → 3.0 s | 17.4 → 22.5 s | 9.1 → 1.7 s |
    | Queen Mary mobile | 8.5 → 1.2 s | 8.0 → 1.6 s | 8.2 → 7.8 s | 5.8 → 1.6 s |
    | King's desktop | 12.3 → 2.4 s | 10.7 → 3.2 s | 11.8 → 24.1 s | 7.3 → 1.5 s |
    | King's mobile | 8.6 → 1.1 s | 7.3 → 1.5 s | 7.5 → 6.9 s | 5.4 → 1.3 s |

  - On desktop under swiftshader the whole city takes longer to appear. There the clouds are software-rendered at 1280×800 and take the container's two cores from the build. On a real GPU the clouds cost the main thread little, so the build gets nearly all of it. The mobile runs (cheap clouds) are the better guide to that: the full city is level or a little sooner.
  - The intro frames once the city is shown are unchanged at every university and device: the same draw calls (±2) and triangles. No console errors anywhere; the UCL fallback works (only its expected 404).
  - For later runs: `render_intro.py` now prints `intro starts` (right after the pick) and waits for `state.worldReady` before `engine up`, so `engine up` is when the city is shown. Under swiftshader it is longer than before on desktop (UCL about 29 s), for the reason above. Compare like with like from here on.

- 2026-11-19 (night, branch `city-refine-2026-11-19`): the Thames 4.5 m below the streets between granite walls, with the Embankment's lamps and festoons and boats on the river; interiors merged per material; far trees and trunks lighter.
  - Realism: the Thames, part 2.
    - `city.js`: the far ground (the 60 km plane in `london.js`, `southken.js` and `cityworld.js`) is now `farGeo`, the plane with the mapped river cut out of it (islands put back). The triangulation is checked by area; if it fails, everything stays as before, flush. Where the river enters the 3 km map (LSE and King's), the map's ground has it cut out of its texture's alpha (an alpha test, only on those two sites). The water is the river's own outline at -4.5 m.
    - The map's own water areas that are the river are dropped triangle by triangle (docks, ponds and canals stay at street level). Moored ships mapped as buildings (the Tattershall Castle, HMS President) reach down to the water.
    - `bridges.js`: with the water lowered, the decks' crowns sit 1 to 4 m above the street, so they run nearly level onto the banks; piers, cutwaters and arches go down to the water.
    - The river walls along every bank: granite with a coping and a parapet, and a darker, wet band below the tide line (2.3 m above the water). Beyond 2.6 km of the campus (1.5 km on mobile) a wall is one face and its coping. Under a bridge only the face, up to the street.
    - Along the Thames within 2.6 km: dark iron lamp standards on the parapet every 26 m, lit, with festoons of bulbs strung between them (one small triangle each, every 2 m; 3.6 m on mobile).
    - Boats: houseboats, lighters (one to three abreast) and pleasure cruisers with lit cabins moored along the Thames' walls, and river buses and cruisers under way along the centreline, within 4.5 km (3 km on mobile).
    - Albert and Chelsea Bridges have strings of bulbs along their chains.
    - Walls, lamps' posts and boats are in the bridges' mesh, and the bulbs and lit windows in their lamps' mesh (now with vertex colours), so the river costs no new draw call.
  - Results by university (`renders/2026-11-19.jpg`, `-pairs.jpg`):
    - UCL: from the river, Hungerford and the Jubilee bridges run level onto walled banks; the Embankment's lamps line the far bank. The intro's own frames (river at 1.8 km) barely change.
    - Imperial: Albert and Chelsea Bridges with their chains lit, the Chelsea Embankment walled with its lamps and festoons. From the intro's frames, small.
    - LSE: Waterloo Bridge's arches now spring from the water, between granite walls; the river reads as a channel below the Embankment in the 0.36 and 0.47 frames.
    - Queen Mary: the walls and boats are on the Thames at Wapping and the City, 2 to 4 km off; the intro's frames barely change. The docks are not lowered yet (part 3).
    - King's: the clearest change. The Victoria Embankment's wall catches the dawn light along the river front, with the festoons on its parapet and houseboats moored below.
  - Lag: the furniture merge (backlog), plus far trees.
    - `mergeInterior` (`materials.js`, called from `engine.js`) merges each interior's static parts into one mesh per material. The scanned furniture was already instanced, so the saving is 5 to 13% of the draw calls in the interior frames, not the hundreds hoped for: what is left there is the city and the instanced furniture.
    - Tree canopies beyond 1.25 km of their tile draw every other lobe, a fifth larger (a third `THREE.LOD` level), and trunks are not drawn beyond 900 m. This more than pays for the walls, bulbs and boats.
    - A first version put one water plane under the whole city, and cut every site's map: ms looked up. The water is now the river's outline only, and the map is cut only at LSE and King's.
  - Before → after, batch runs (before at 23:44, after at 00:39; ms are swiftshader ms between frames, so only the change counts):

    | Desktop | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 29 → 22 s | 2216 → 2050 / 267 → 237 / 0.91 → 0.73M | 2067 → 2067 / 217 → 202 / 0.92 → 0.84M | 3400 → 3666 / 710 → 646 / 3.02 → 3.00M |
    | Imperial | 40 → 40 s | 2183 → 2366 / 415 → 381 / 1.03 → 0.88M | 2417 → 2733 / 380 → 359 / 1.18 → 1.11M | 2250 → 2500 / 518 → 479 / 1.45 → 1.42M |
    | LSE | 34 → 30 s | 2266 → 2050 / 295 → 260 / 0.99 → 0.79M | 2100 → 2033 / 239 → 216 / 0.74 → 0.64M | 2783 → 2417 / 293 → 268 / 1.01 → 0.96M |
    | Queen Mary | 37 → 31 s | 1933 → 1783 / 418 → 365 / 0.99 → 0.64M | 2117 → 2033 / 347 → 315 / 1.02 → 0.83M | 2483 → 2600 / 384 → 360 / 1.67 → 1.63M |
    | King's | 30 → 32 s | 2050 → 1950 / 285 → 253 / 0.90 → 0.77M | 1950 → 1866 / 241 → 224 / 0.62 → 0.57M | 2517 → 2366 / 333 → 299 / 0.84 → 0.80M |

    | Mobile | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 14 → 15 s | 183 → 217 / 187 → 180 / 0.49 → 0.47M | 183 → 233 / 168 → 165 / 0.51 → 0.51M | 433 → 533 / 506 → 451 / 2.24 → 2.25M |
    | Imperial | 23 → 29 s | 200 → 233 / 321 → 308 / 0.44 → 0.42M | 200 → 250 / 294 → 288 / 0.55 → 0.55M | 250 → 283 / 451 → 422 / 0.98 → 0.98M |
    | LSE | 21 → 22 s | 233 → 217 / 200 → 186 / 0.40 → 0.36M | 200 → 200 / 178 → 170 / 0.41 → 0.40M | 200 → 200 / 244 → 229 / 0.72 → 0.73M |
    | Queen Mary | 21 → 22 s | 200 → 200 / 284 → 264 / 0.42 → 0.34M | 200 → 200 / 260 → 248 / 0.44 → 0.40M | 300 → 250 / 328 → 315 / 0.85 → 0.85M |
    | King's | 21 → 22 s | 233 → 217 / 204 → 191 / 0.41 → 0.38M | 183 → 183 / 183 → 177 / 0.35 → 0.35M | 217 → 217 / 284 → 262 / 0.58 → 0.58M |

  - Interleaved runs (before, after, before, after, 00:55 to 01:20) where the batch showed ms up; the machine had slowed (a rerun of the before build of Imperial mobile at 00:37 gave 217 / 250 / 267 ms, against 200 / 200 / 250 in the before batch):
    - UCL mobile: 0.36 at 250 / 250 → 250 / 250 ms; 0.47 at 250 / 233 → 233 / 250 ms; 0.56 at 500 / 517 → 500 / 500 ms.
    - Imperial mobile: 0.36 at 233 / 233 → 250 / 233 ms; 0.47 at 267 / 250 → 267 / 250 ms; 0.56 at 300 / 317 → 317 / 317 ms; engine up 27 / 28 → 28 / 28 s.
    - Imperial desktop: 0.36 at 2450 / 2417 → 2350 / 2367 ms; 0.47 at 2666 / 2616 → 2616 / 2650 ms; 0.56 at 2433 / 2467 → 2466 / 2516 ms; engine up 39 / 38 → 40 / 37 s.
    - UCL desktop: 0.36 at 2283 / 2233 → 2133 / 2250 ms; 0.47 at 2216 / 2117 → 2117 / 2300 ms; 0.56 at 3783 / 3700 → 3616 / 3866 ms.
    - So ms per frame is level within noise at UCL and Imperial, and lower at LSE, Queen Mary and King's desktop in the batch. Engine up is lower or level.
  - What holds in every run: draw calls lower at every frame, university and device (by 1–13%), and triangles lower or level: by up to 35% on desktop at 0.36 (Queen Mary 0.99 → 0.64M), from the far trees. UCL and LSE mobile at 0.56 are +0.01M, within a run's rounding.
  - Interior frames (0.73 / 0.82, batch, before at 00:04, after at 01:29): draws 558 → 507 / 213 → 203 (UCL desktop), 337 → 301 / 277 → 247 (Imperial), 253 → 231 / 115 → 109 (LSE), 234 → 213 / 94 → 91 (Queen Mary), 248 → 218 / 97 → 95 (King's); on mobile 1–9% fewer. Triangles level (±0.02M), ms level within the drift (UCL desktop 0.73 at 5816 → 5883 ms, King's 3600 → 3533 ms).
  - Size: city JSON unchanged (no rebake). City vertices +0.5% to +1.9% (desktop 2.53M to 2.75M, mobile 0.84M to 0.90M). Shader programs at the end of each run: unchanged at every university (the start-up count varies with when the furniture loads, as before).
  - Checks:
    - no console errors at any of the five universities, on desktop or mobile, in the intro, interior and close-up runs;
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404 is logged; the hand-built city renders, and the skip button clears the intro on mobile. On desktop the skip check reads before the fade ends under swiftshader, on main's build too).
  - Sheets: `renders/2026-11-19.jpg` (one after frame per university, along the river, and King's and LSE at 0.47), `-pairs.jpg` (UCL, Imperial, LSE and King's before and after).
  - Next:
    - "The Thames, part 3": the docks and the Lea lowered and walled at Queen Mary, boats at the real piers, the foreshore;
    - the shader-programs item is now the top lag item.

- 2026-11-17 (night, branch `city-refine-2026-11-17`): the Thames as mapped, with its bridges; landmarks and water merged into fewer draw calls.
  - Realism: the Thames.
    - `bake_city.py` writes the river surfaces (OSM `water=river`: the Thames, and the Lea near Queen Mary) from the skyline extract, simplified to 2.5 m and clipped to 12.5 km round each site, as `rv` (about 2,100 to 2,400 points, 10 polygons).
    - It also writes the bridges that cross them as `bg`, from the mapped `man_made=bridge` outlines in the site's and the skyline's extracts (within 5 km): the outline's smallest rectangle gives the deck's line, length and width, and sampling the river along it gives the stretch over water. Named bridges get a style, span count, paint and deck height (`BRIDGE_STYLE`); the rest go by `bridge:structure`. The skyline extract's filter now keeps named bridge outlines, so Lambeth, Vauxhall and Tower Bridge came with this run's fetch.
    - `city.js` draws the river from its outline for all five intros, merged with the map's own water into one mesh. UCL and Imperial had a made-up curve (`riverX`); Queen Mary, LSE and King's had a ribbon through the centreline's x(z) samples, which cut the Westminster bend.
    - A 1024 px mask of the river over ±12 km replaces the river functions in the cloud shader (the ground under the clouds) and keeps the outer ring of blocks off the water. It is softened by a pixel and a half before the shader's threshold, so the far banks are curves, not texel steps. The hand-built fallback keeps `riverX` and `RIVER_GLSL`.
    - `bridges.js`: Waterloo in Portland stone with five shallow arches; Westminster (green), Vauxhall, Lambeth and Blackfriars (red), Southwark and Battersea as painted iron arches with open spandrels on granite piers with cutwaters; London Bridge, Hungerford, the Golden Jubilee footbridges, the Millennium Bridge and the railway bridges as girders on piers; Chelsea and Albert (pink) as suspension bridges with towers, chains and hangers; Tower Bridge with its two towers, pyramid roofs, corner turrets, high-level walkways and the side spans' chains. Decks ramp down to the banks, with footways, parapets and lit lamps. All bridges are one mesh with vertex colours plus one for the lamps. Beyond 2.2 km from the campus a bridge drops its footways, inner parapets, lamp posts and hangers.
    - The London Eye and Battersea Power Station now stand at their mapped places in the Imperial intro (the Eye was about 1 km off, on the made-up river).
  - Results by university (`renders/2026-11-17.jpg`, `-pairs.jpg`, `-intro.jpg`):
    - UCL: the river beyond Bloomsbury follows the Embankment's bend, with Waterloo Bridge, Hungerford and the Jubilee footbridges on it. It was a straight synthetic band.
    - Imperial: the Chelsea and Battersea reaches as mapped, with Albert, Battersea and Chelsea Bridges, and Vauxhall further off. The made-up river ran about 600 m north of the real one at Chelsea.
    - LSE: the river now bends south at Westminster past the London Eye (it was land beyond the map's edge there), with Westminster Bridge; Waterloo Bridge crosses in front of Somerset House.
    - Queen Mary: the Thames at Limehouse and Tower Bridge on the river to the south-west, and the Lea to the east, in the cloud stage and from the air.
    - King's: Waterloo Bridge beside the King's Building's river front, Hungerford and Westminster up river.
    - The intro's own frames at 0.36 to 0.56 barely change, as the bridges are small from there; the change shows along the river and in the cloud stage.
  - Lag (the backlog's furniture merge is not done; this run's measured reduction instead):
    - the map's water areas (31 to 77 meshes, one draw each) and the river are one mesh;
    - St Paul's (about 50 meshes), the BT Tower (15), the London Eye, the Albert Memorial (about 65), the Royal Albert Hall, the Natural History Museum and the V&A are merged into one mesh per material (`mergeStatic`, `mergeSince` in `southken.js`). Facade boxes are left alone, as their windows come from each box's own scale;
    - boxes standing on the ground or on a roof (outer blocks, trunks, chimneys, plant) lose their hidden bottom face (`groundBox`): 10 triangles each, not 12. That more than pays for the bridges' triangles.
  - Before → after, batch runs (all before at 23:45, all after at 01:10). Ms are swiftshader ms between frames, so only the change counts.

    | Desktop | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 27 → 18 s | 2033 → 2100 / 292 → 267 / 0.93 → 0.91M | 1917 → 1967 / 219 → 217 / 0.93 → 0.92M | 3716 → 3833 / 721 → 710 / 3.03 → 3.02M |
    | Imperial | 40 → 39 s | 2200 → 2233 / 504 → 415 / 1.04 → 1.02M | 2333 → 2383 / 466 → 380 / 1.20 → 1.19M | 2383 → 2350 / 535 → 518 / 1.46 → 1.44M |
    | LSE | 34 → 30 s | 2083 → 2067 / 321 → 296 / 0.99 → 0.99M | 1983 → 2050 / 243 → 239 / 0.75 → 0.74M | 2383 → 2383 / 293 → 293 / 1.01 → 1.01M |
    | Queen Mary | 34 → 30 s | 1767 → 1883 / 463 → 418 / 1.01 → 0.99M | 1917 → 2017 / 375 → 347 / 1.04 → 1.02M | 2400 → 2516 / 394 → 384 / 1.69 → 1.67M |
    | King's | 30 → 30 s | 1900 → 1950 / 292 → 284 / 0.88 → 0.88M | 1800 → 1867 / 243 → 240 / 0.62 → 0.62M | 2267 → 2300 / 333 → 333 / 0.85 → 0.85M |

    | Mobile | engine up | 0.36: ms / draws / tris | 0.47: ms / draws / tris | 0.56: ms / draws / tris |
    |---|---|---|---|---|
    | UCL | 14 → 14 s | 217 → 217 / 204 → 189 / 0.50 → 0.49M | 200 → 233 / 167 → 168 / 0.51 → 0.51M | 866 → 1000 / 517 → 506 / 2.25 → 2.24M |
    | Imperial | 25 → 26 s | 250 → 233 / 407 → 321 / 0.44 → 0.44M | 217 → 233 / 366 → 294 / 0.55 → 0.55M | 433 → 483 / 463 → 451 / 0.99 → 0.98M |
    | LSE | 19 → 21 s | 200 → 200 / 202 → 201 / 0.40 → 0.40M | 183 → 183 / 178 → 178 / 0.42 → 0.41M | 250 → 267 / 242 → 244 / 0.73 → 0.72M |
    | Queen Mary | 19 → 20 s | 233 → 250 / 303 → 284 / 0.44 → 0.42M | 217 → 217 / 273 → 260 / 0.46 → 0.44M | 350 → 350 / 333 → 328 / 0.86 → 0.85M |
    | King's | 20 → 20 s | 217 → 217 / 204 → 204 / 0.41 → 0.41M | 183 → 183 / 182 → 183 / 0.35 → 0.35M | 283 → 283 / 284 → 285 / 0.58 → 0.57M |

  - Interleaved runs (before, after, before, after) where the batch showed ms up:
    - King's desktop: 0.36 at 1917 / 1917 → 1917 / 1966 ms; 0.47 at 1833 / 1867 → 1883 / 1817 ms; 0.56 at 2333 / 2316 → 2333 ms.
    - Queen Mary desktop: 0.36 at 1917 / 1950 → 1850 / 1950 ms; 0.47 at 2083 / 2066 → 2033 / 2100 ms; 0.56 at 2483 / 2483 → 2333 / 2483 ms.
    - UCL mobile: 0.56 at 983 / 983 → 933 / 933 ms (the batch's 866 → 1000 was drift).
    - Imperial mobile: 0.36 at 233 / 250 → 250 / 233 ms; 0.56 at 450 / 467 → 467 / 467 ms.
    - So ms per frame is level within noise everywhere; engine up is lower or level (UCL desktop 27 → 18 s, LSE 34 → 30 s, Queen Mary 34 → 30 s).
  - What holds in every run: draw calls lower or level at every frame, university and device (Imperial by 17–21%, from the Albert Memorial and Royal Albert Hall merges; UCL, Queen Mary and LSE desktop at 0.36 by 2–10%; elsewhere at LSE and King's level, within two draws), and triangles lower or level (by up to 0.02M).
  - A note for later runs: a push that changes `bake_city.py` re-runs the fetch, which refreshes the site extracts too. Their small changes reshuffle the park trees (their random placement follows the map's areas) and moved King's 0.36 by +0.02M triangles (one more near tree tile). This branch keeps the site extracts as on main and takes only the new skyline extract; the monthly refresh brings the rest. The second push's fetch failed to reach Geofabrik (connection refused); nothing depended on it. Merging this into main re-runs the fetch there, which brings the refreshed extracts (and that tree reshuffle) to main, as the monthly refresh would.
  - Size: city JSON gzipped is 0.87 MB (UCL), 0.77 MB (Imperial), 1.04 MB (LSE), 0.84 MB (Queen Mary) and 1.02 MB (King's): `rv` and `bg` add about 13 KB each. City vertices: desktop +0.3% to +1.2% (2.52M to 2.74M), mobile +1% to +3% (0.82M to 0.88M), counted as in the 2026-11-12 note. Shader programs: +2 (the bridges and their lamps).
  - Checks:
    - no console errors at any of the five universities, on desktop or mobile (an Albert Bridge NaN on mobile, from a chain sample just past the deck's end, was found and fixed in this run);
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404 is logged; the skip button still works).
  - Sheets: `renders/2026-11-17.jpg` (one after frame per university along the river), `-pairs.jpg` (LSE, King's, Imperial, UCL and Queen Mary before and after), `-intro.jpg` (intro frames at 0.47, after).
  - Next:
    - see "The Thames, part 2": the water sits flush with the streets, so the decks ramp down to it. Lowering the river with granite river walls would let them run level onto the banks;
    - the furniture merge (lag backlog) is still the top lag item.

- 2026-11-14 (night, branch `city-refine-2026-11-14`): roofs, and a stripped facade program for far tiles.
  - Realism: roofs.
    - `bake_city.py` now writes the roof shape as `rs + 10 × covering`. OSM `roof:shape=mansard` and `gambrel` are shape 5 (they were hipped, or unmapped). `roof:material` gives covering 1 glass, 2 zinc, lead or other sheet metal, 3 copper. Tagged: UCL 185 mansard or gambrel, 266 glass, 6 metal and 4 copper roofs; Imperial 66 mansards and 2 glass; LSE 125 mansards, 381 glass, 12 metal and 103 copper; Queen Mary 103 mansards, 7 glass and 2 metal. The city JSON version is now 3.
    - Mansards: individually mapped terrace houses (brick or stucco) of 13 m and over get a slate mansard 62% of the time (the rest keep a low pitched roof). The slopes run front and back between the party walls, behind a 0.6 m parapet, with a felt top. OSM-mapped mansards on blocks slope all round. Each slope has dormers (two or three on a house, one every 3 m on a block), with white-framed windows, lead cheeks and a zinc top; about one in seven is lit. The party-wall chimney stacks stay.
    - Parapets with copings on flat roofs (out to 1.6 km on desktop, 0.7 km on mobile): the roof drops 0.95 m (0.55 m on modern blocks) behind the wall top, and a strip runs from a stone or metal coping down to the roof, in the wall's colour in shade. Courtyards get one too.
    - Modern blocks (post-war, glass or concrete, 15 to 70 m, a clean rectangle), 30% of them: the top storey is set back 1.8 m behind a terrace, glazed, in a zinc-grey frame under a standing-seam zinc roof, with decking on part of the terrace.
    - Rooflights: on about half of the flat roofs over 120 m² (one to six, plus a long glazed strip on some large roofs), and in 40% of the terrace houses' slate roofs. They reflect the sky, and some are lit from below.
    - Roof terraces: timber decking and planters on about a fifth of the flat roofs between 60 and 1,500 m² and 9 m or taller. Banks of condenser units sit beside the existing plant.
    - Coverings: zinc with standing seams on modern pitched roofs and on mapped metal roofs, verdigris on copper, glass on mapped glass roofs (for example the Great Court and the LSE glass roofs).
    - All of this is drawn by the roof shader from a per-vertex covering code, so it adds no shader program and no draw call.
  - Results by university, from the close-up cameras (`renders/2026-11-14-pairs.jpg`):
    - UCL: the Bloomsbury terraces carry mansards with rows of dormers, and the flat-roofed blocks have parapets and rooflights.
    - Imperial: the stucco blocks south of the campus read as parapeted, with a dormered mansard terrace among them; flat roofs show their copings.
    - LSE: the flat-roofed blocks get parapets, copings and plant. There are fewer mansards, because few houses there are individually mapped.
    - Queen Mary: the tall Mile End terraces trade their street-facing gables for dormered mansards. The two-storey terraces keep their pitched roofs.
    - From the intro's own frames, the change is subtle at 0.36 and visible at 0.47, where the roofs gain copings, rooflights and plant (`renders/2026-11-14-intro.jpg`).
  - Lag:
    - Walls: each 400 m tile is a `THREE.LOD`. Beyond 720 m from the tile's centre, its walls draw with a stripped facade program on the same vertices. That program keeps the window grid, the rooms' mean glow and the shopfronts' averages, so the switch does not show. It drops the interior mapping, the photo textures, the doors, the glazing bars, the ironwork and the bay windows. The skyline beyond the map always uses it.
    - Roofs: a second `THREE.LOD` per tile draws the parapets, dormers, rooflights, decking and bay-window tops only within 470 m of the tile's centre. They are detail triangles at the end of the index, so the far level is a draw range on the same buffers, with no copy.
    - Chimneys, plant and planters are not drawn beyond 850 m from their tile's centre, where they are a couple of pixels across.
    - `render_intro.py` counts a far LOD copy's shared vertices once, and has close-up cameras (`CAMS="x,y,z,lx,ly,lz;…"`).
  - Before → after, batch runs (all of before, then all of after). Swiftshader seconds a frame, so only the change counts.

    | Desktop | engine up | 0.36: s / draws / tris | 0.47: s / draws / tris | 0.56: s / draws / tris |
    |---|---|---|---|---|
    | UCL | 26 → 20 s | 2.42 → 2.07 / 324 → 292 / 0.97 → 0.93M | 2.12 → 1.93 / 234 → 219 / 0.92 → 0.93M | 4.77 → 3.68 / 736 → 721 / 3.05 → 3.03M |
    | Imperial | 41 → 33 s | 2.60 → 2.33 / 539 → 504 / 1.11 → 1.04M | 2.67 → 2.48 / 489 → 466 / 1.25 → 1.20M | 2.70 → 2.47 / 552 → 535 / 1.46 → 1.46M |
    | LSE | 34 → 28 s | 2.42 → 2.10 / 361 → 322 / 1.05 → 1.00M | 2.13 → 2.00 / 266 → 243 / 0.77 → 0.75M | 2.53 → 2.42 / 306 → 293 / 1.02 → 1.01M |
    | Queen Mary | 35 → 28 s | 2.25 → 1.92 / 524 → 463 / 1.13 → 1.01M | 2.38 → 2.07 / 410 → 375 / 1.11 → 1.04M | 2.78 → 2.55 / 410 → 394 / 1.71 → 1.69M |

    | Mobile | engine up | 0.36: s / draws / tris | 0.47: s / draws / tris | 0.56: s / draws / tris |
    |---|---|---|---|---|
    | UCL | 16 → 14 s | 0.23 → 0.22 / 215 → 205 / 0.51 → 0.50M | 0.23 → 0.22 / 171 → 167 / 0.51 → 0.51M | 0.97 → 0.83 / 522 → 517 / 2.24 → 2.25M |
    | Imperial | 26 → 24 s | 0.28 → 0.27 / 421 → 407 / 0.46 → 0.44M | 0.30 → 0.22 / 373 → 366 / 0.56 → 0.55M | 0.45 → 0.43 / 467 → 463 / 0.99 → 0.99M |
    | LSE | 20 → 19 s | 0.25 → 0.18 / 217 → 201 / 0.42 → 0.40M | 0.20 → 0.18 / 187 → 178 / 0.42 → 0.42M | 0.28 → 0.25 / 248 → 242 / 0.72 → 0.73M |
    | Queen Mary | 21 → 19 s | 0.28 → 0.23 / 329 → 303 / 0.48 → 0.44M | 0.23 → 0.23 / 289 → 273 / 0.48 → 0.46M | 0.40 → 0.33 / 336 → 333 / 0.86 → 0.86M |

  - Interleaved runs (before, after, before, after), because the batch above may carry drift:
    - UCL desktop: engine up 22 / 21 → 22 / 23 s; 0.36 at 2.25 / 2.33 → 2.20 / 2.25 s; 0.47 at 2.17 / 2.03 → 2.18 / 2.05 s; 0.56 at 4.47 / 4.12 → 4.17 s.
    - LSE desktop: engine up 30 / 30 → 31 / 32 s; 0.36 at 2.42 / 2.42 → 2.32 / 2.27 s; 0.47 at 2.32 / 2.20 → 2.13 / 2.37 s; 0.56 at 2.63 / 2.68 → 2.65 / 2.62 s.
    - So, under swiftshader: ms per frame is level within noise at UCL and LSE (LSE 0.36 a little lower), not the 10–15% of the batch. Engine up is level within noise.
    - What does hold in every run: fewer draw calls at every frame, university and device (by 1–12%), and triangles lower or level (UCL desktop 0.47 at +0.01M, LSE and UCL mobile 0.56 at +0.01M, all within a run's rounding).
    - A first version with all roof detail out to 720 m (the wall distance) had 3–5% more triangles at UCL and LSE. The shorter roof distance and the chimney cut-off won that back.
  - Size: city JSON gzipped is 0.86 MB (UCL), 0.76 MB (Imperial), 1.03 MB (LSE) and 0.84 MB (Queen Mary), unchanged. City vertices are up on desktop by 9% (UCL 2.49 → 2.72M), 7% (Imperial 2.44 → 2.60M), 9% (LSE 2.46 → 2.68M) and 4% (Queen Mary 2.41 → 2.51M), and on mobile by 3–6% (0.81–0.87M). Shader programs: +1 at each university (the far facade program; LSE's start-up count varies by about 9 between runs).
  - Checks:
    - no console errors at any of the four universities, on desktop or mobile;
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404 is logged).
  - Sheets: `renders/2026-11-14.jpg` (one close-up after frame per university), `-pairs.jpg` (UCL, Imperial and Queen Mary before and after, close up), `-intro.jpg` (intro frames at 0.47, after).
  - Next:
    - The roofs read very dark at dawn from the intro's height. The felt and slate colours could be lifted a little, and the copings could catch the low sun more, so the new roofscape shows in the aerial frames as well as close up.
    - The LiDAR 90th percentile (see 2026-11-13) could choose which terraces have pitched roofs and which have mansards, in place of the 62% split.

- 2026-11-13 (night, branch `city-refine-2026-11-13`): LiDAR heights for the guessed buildings, and one wall mesh per tile.
  - Realism: heights from Environment Agency LiDAR.
    - `lidar_heights.py` runs in CI (`fetch-city-lidar.yml`). It fetches the 2022 LiDAR Composite last-return DSM and DTM, 1 m, as 5 km tiles from the survey download API, and takes the median of DSM minus DTM under each footprint. It skips the 1 m pixels on the footprint's edge, where the beam mixes roof and street. The ArcGIS image service found no LiDAR layers, so the tile route is the one in use.
    - `bake_city.py` uses the measured height only where OSM has no height or levels tag, and only when at least 6 pixels and a quarter of the footprint were seen and the height is 2.5 to 160 m. A footprint built after the survey reads as near-ground, so it keeps its guess.
    - Measured: UCL 5,584 buildings, Imperial 1,201, LSE 4,533, Queen Mary 4,239. That is 97% of the guessed buildings; 184, 122, 220 and 401 stay guessed.
    - Check against buildings that do have tags: LiDAR over OSM `height` has a median ratio of 1.02 (UCL), 0.98 (LSE) and 0.85 (Queen Mary), with a median error of 2–3 m. Over levels × 3.3 m the ratio is 1.03, 1.01 and 0.88, with a median error of 1.4–2.1 m.
    - Change from the guesses: 3,290 buildings at UCL move by more than 3 m (median 3.8 m, no overall bias). Imperial: 719 (median 4.1 m). LSE: 2,727 (median 3.9 m). Queen Mary: 3,197 (median 5.4 m), where the guesses were about 5 m too tall on average. The Mile End terraces now sit lower.
    - The intro credit now reads "Map data © OpenStreetMap contributors · Heights © Environment Agency LiDAR (OGL)". On mobile it wraps to two lines.
    - City JSON gzipped: 0.85 MB (UCL), 0.76 MB (Imperial), 1.02 MB (LSE), 0.83 MB (Queen Mary). The LiDAR caches in `raw/` are 0.1–0.17 MB each.
  - Results by university, from the intro frames: the change is moderate from the air.
    - UCL: blocks around the Main Quad change height. The 0.47 frame shows the clearest differences in the foreground and on the right.
    - Imperial: few buildings were guessed (1.2k), so the frames barely change.
    - LSE: the blocks between the campus and the river change height, and the skyline in the 0.47 frame is more uneven.
    - Queen Mary: the guessed terraces drop by about 5 m on average. From the intro's height this is a subtle change.
  - Lag: the four wall families are layers of one array texture (`DataArrayTexture`), so every tile draws its walls in one call instead of up to four. This also applies to the shadow pass.
    - Walls beyond 650 m use their layer's average colour, and skip the photo and normal-map samples.
    - `textureGrad` keeps the mip level right across that branch.
  - Before → after, batch runs (one after another, desktop then mobile per university). Ms are swiftshader seconds a frame, so only the change matters. The machine slowed down during the night, and the before batch ran first, so the UCL desktop row is skewed; see the interleaved runs below.

    | Desktop | engine up | 0.36: s / draws / tris | 0.47: s / draws / tris | 0.56: s / draws / tris |
    |---|---|---|---|---|
    | UCL | 41 → 62 s (drift; interleaved: 58 → 48 s) | 8.8 → 10.0 / 417 → 324 / 0.97 → 0.97M | 8.2 → 9.5 / 292 → 234 / 0.93 → 0.92M | 19.9 → 20.7 / 799 → 736 / 3.05 → 3.05M |
    | Imperial | 113 → 106 s | 10.8 → 10.0 / 637 → 539 / 1.11 → 1.11M | 11.7 → 10.5 / 563 → 488 / 1.23 → 1.24M | 12.2 → 11.1 / 609 → 552 / 1.47 → 1.46M |
    | LSE | 74 → 82 s (interleaved: 77 → 75 s) | 10.7 → 10.2 / 474 → 361 / 1.05 → 1.05M | 9.8 → 9.5 / 347 → 265 / 0.77 → 0.77M | 13.0 → 12.6 / 363 → 306 / 1.01 → 1.02M |
    | Queen Mary | 90 → 84 s | 10.2 → 8.9 / 652 → 524 / 1.12 → 1.13M | 9.8 → 9.3 / 497 → 410 / 1.12 → 1.11M | 12.9 → 12.1 / 458 → 410 / 1.72 → 1.71M |

    | Mobile | engine up | 0.36: s / draws / tris | 0.47: s / draws / tris | 0.56: s / draws / tris |
    |---|---|---|---|---|
    | UCL | 38 → 33 s | 1.4 → 1.5 / 256 → 215 / 0.50 → 0.51M | 1.6 → 1.6 / 200 → 171 / 0.50 → 0.51M | 3.1 → 3.2 / 549 → 522 / 2.24 → 2.24M |
    | Imperial | 77 → 73 s | 1.5 → 1.4 / 459 → 421 / 0.46 → 0.46M | 1.7 → 1.6 / 397 → 373 / 0.56 → 0.56M | 1.8 → 1.6 / 489 → 467 / 1.01 → 0.99M |
    | LSE | 56 → 53 s | 1.6 → 1.4 / 266 → 219 / 0.42 → 0.42M | 1.5 → 1.5 / 220 → 187 / 0.42 → 0.42M | 2.3 → 2.3 / 274 → 248 / 0.73 → 0.72M |
    | Queen Mary | 48 → 55 s (interleaved: 54 → 56 s) | 1.3 → 1.3 / 394 → 329 / 0.48 → 0.48M | 1.3 → 1.2 / 331 → 289 / 0.48 → 0.48M | 2.0 → 1.8 / 355 → 338 / 0.86 → 0.87M |

  - Interleaved runs, alternating before and after so drift cancels:
    - UCL desktop, 3 pairs: engine up 65 / 60 / 48 → 48 / 43 / 53 s; 0.36 at 10.3 / 9.9 / 9.7 → 9.6 / 9.7 / 9.4 s; 0.47 at 9.5 / 9.1 / 8.3 → 9.3 / 9.8 / 8.7 s; 0.56 at 19.4 → 19.2 s.
    - UCL mobile, 2 pairs: engine up 33 / 30 → 31 / 31 s; 0.36 at 1.43 / 1.43 → 1.40 / 1.53 s; 0.47 at 1.65 / 1.68 → 1.65 / 1.80 s; 0.56 at 3.02 / 3.05 → 3.02 / 3.12 s.
    - LSE desktop, 1 pair: engine up 77 → 75 s; 0.36 at 9.6 → 9.5 s; 0.47 at 8.9 → 9.6 s.
    - Queen Mary mobile, 1 pair: engine up 54 → 56 s; 0.36 at 1.18 → 1.15 s; 0.47 at 1.18 → 1.23 s.
    - Run to run, the same build varies by about ±7% in ms and ±10 s in engine up.
  - Overall: draw calls are down at every frame, university and device (by 5–25%), triangles are level, and engine up is lower or within noise. Ms per frame is lower at Imperial and Queen Mary in the batch, and level within noise at UCL and LSE in the interleaved runs.
    - The far-wall path did not show as a measurable ms win under swiftshader. Its cost is the texture samples, which are cheap there next to the interior-mapping code.
    - City vertices are level, from -0.3% to +0.4% with the new heights. Shader programs are unchanged (199 UCL, 149 Imperial, 91 LSE, 89 Queen Mary at start-up).
  - A harness note: the intro steps its quality down (AO off, then lower resolution, then fewer cloud steps) after enough slow frames. How many frames a run has rendered before a shot therefore changes the ground's look between runs.
    - The after batch's Queen Mary park came out darker. A single-shot rerun of the same build, with and without the far-wall path, matched the before batch's brightness (20.0 / 20.0 against 20.1 in the park).
    - So compare like-for-like sequences.
  - Checks:
    - no console errors at any of the four universities, on desktop or mobile;
    - the engine starts everywhere;
    - the hand-built UCL fallback still works with `ucl.json` missing (only its expected 404 is logged).
  - Sheets: `renders/2026-11-13.jpg` (one after frame per university at 0.47) and `-pairs.jpg` (UCL and LSE before and after at 0.47, guessed heights against LiDAR).
  - Next:
    - The LiDAR caches also store the 90th percentile. Where it sits 2 m or more above the median on a small footprint, the roof is pitched, which can feed the Roofs item (roof shape and ridge height).
    - The far-facade program (the next lag item) should skip the interior mapping beyond about 600 m, which is where swiftshader spends its time.

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
