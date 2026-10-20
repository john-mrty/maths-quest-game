# Sunny Meadow visual polish

Sunny Meadow now includes a timber bridge following the existing racing surface, an animated waterfall and stream, mist, a pastel rainbow and instanced flower borders. Track geometry and racing physics use the same road samples. The bridge deck, posts, rail caps and flowers use instancing; medium quality reduces flowers and mist.

All karts gain clear-coated paint, sculpted wheel arches, rear lights, subtle suspension movement and driver lean during boosts. The racing camera anticipates bends with gentle banking, and boosts add peripheral speed streaks. Correct gate answers release golden particles. Reduced-motion preferences disable the added roll, boost zoom, speed streaks and orbiting camera movements.

The review scene at `docs/previews/turbo-meadow.html` uses the actual track, kart, sky and lighting code, with buttons for the crossing and a kart close-up. It is a visual inspection scene, not a race. Run the normal app to test gameplay.

Verification: geometry/camera/kart checks, profile integration checks and service-worker checks pass (13 tests). A browser review verified the landmark and kart rendering without console errors. Desktop and phone-width race checks cover rendering and maths feedback; physical iPad/phone performance still needs device testing. Cache version 62 refreshes the game modules on app update.

Run the relevant tests with:

```
deno test --allow-read --import-map=tests/three-import-map.json tests/turbo-visuals.test.mjs tests/turbo-tables.test.mjs tests/service-worker.test.cjs
```
