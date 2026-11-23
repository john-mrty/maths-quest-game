# Quest browser VR

Turbo Tables offers **Race in VR** beside Race when a secure browser reports support for an `immersive-vr` WebXR session. It uses the existing Three.js scene and learner progress. Normal desktop, phone, tablet and Duo controls keep their existing behaviour.

## Playing

Open the HTTPS deployment in Meta Quest Browser, select a learner, open Turbo Tables and choose the racer and track. With the Touch controllers paired, select **Race in VR** and grant the browser's permission. Play seated. The normal Race button remains a flat browser game.

| Control | Action |
| --- | --- |
| Left thumbstick | Steer, with automatic acceleration |
| Left grip | Brake in classes 4–6 |
| A | Use the ready item |
| Point at an answer + index trigger | Answer a question |
| Right thumbstick left/right, then A | Alternative answer selection |
| X or B | Pause/resume |
| A or trigger while paused | Resume |
| A or trigger on the results panel | Race again |
| Y | Leave VR |

Questions, their ten-second timer, correct-answer feedback, countdown, position, lap, ready item, pause and results appear on a stereo scene panel. Steering cannot select an answer. Held A presses are released before a new question can be confirmed. The trigger acts on press rather than release, preventing a trigger held before a question from answering on release.

## Rendering and lifecycle

- The renderer owns a single `setAnimationLoop` for ordinary and XR frames. Immersive starts/restarts do not depend on window animation frames, which may be suspended in VR.
- A local reference space preserves headset tracking inside a seated chase rig. The rig has no intro orbit, camera roll, collision shake, speed streaks or boost field-of-view changes. Steering still turns the chase rig along the course.
- VR uses low-detail scenery, no post-processing/shadows, an 85% XR framebuffer scale and compositor foveation. These are conservative starting settings, not a measured Quest 2 frame-rate claim.
- The embedded frame explicitly allows `xr-spatial-tracking`. A restrictive hosting Permissions-Policy must also permit the game's same-origin frame.
- Losing session visibility pauses the race and freezes input. Leaving VR returns to the ordinary paused race (or the results). Quitting disposes the race and ends the XR session; restarting preserves the XR-owned rig and interface.
- No DOM-overlay extension, headset user-agent sniffing, external runtime or account is required. Hand tracking is not a steering input; use Touch controllers.

## Verification

Run the existing racing, controls, graphics, service worker and VR suites:

```sh
deno test --allow-read --import-map=tests/three-import-map.json tests/vr.test.mjs tests/retro-controls.test.mjs tests/driving.test.mjs tests/graphics.test.mjs tests/haptics.test.mjs tests/tap-steering.test.mjs tests/turbo-gameplay.test.mjs tests/turbo-visuals.test.mjs tests/turbo-tables.test.mjs tests/service-worker.test.cjs
```

Automated checks cover independent steering/answers, held-button protection, junior brakes, session entry failure/exit, headset interruption, tracked-camera preservation, race rebuilds, scene question/results content and direct stereo rendering while paused. They do not exercise a real XR compositor or measure headset performance.

Before release, use a physical Quest 2 on an HTTPS preview to check permission entry from the iframe, text legibility, controller pointing, all three tracks, pause/system-menu return, recentering, restart/exit and sustained frame rate. Localhost on a development computer is not the headset's localhost; an unsecured LAN HTTP address does not provide WebXR.
