# Turbo Tables integration

Imported from the user's `/Users/johnmoriarty/src/projects/Maths-quest/turbo-tables` project on 18 October 2026. The original folder and ZIP are unchanged. Three.js 0.160 is kept separate from Maths Quest's existing version; its MIT licence is in `turbo-tables/vendor/three/LICENSE`.

## Behaviour

- Replaces the Turbo Trail landing tile. Existing Turbo Trail history and source are retained, not reset or deleted.
- Keeps the supplied three-track, three-lap race, racers, items, maths stops and feedback. It does not impose the old Turbo Trail survival/lives rules on the new lap-based game.
- Opens directly at racer/track setup for the active learner's name and class. Younger learners default to Easy driving. The supplied operation picker remains available within that class.
- Remembers choices and adaptive fact memory under the active learner's `turboTables` object, not a shared name-based storage key.
- Records completed races in existing learning history and question/accuracy totals. Best race times are separated by track, class and Easy/manual driving.
- Isolates imported rendering, input and styles in an iframe. Messages check origin, frame identity and session token. Closing destroys the iframe and its renderer/audio context; hiding the app pauses the race.
- Pre-caches the imported entry point and transitive module dependencies. Embedded navigation has its own offline shell so it cannot overwrite Maths Quest's root offline page.
- Removes the remote Google Fonts dependency; uses local system fallback fonts. Embedded tilt is disabled to match the app's current steering choice.

## Verification

Run `deno test --allow-read tests/turbo-tables.test.mjs tests/service-worker.test.cjs` for bridge validation, duplicate-result protection, per-learner maths memory, question correctness and offline module coverage. The broader existing maths/racing checks also pass.

Browser verification is still required: the browser runtime could not connect in this session. Local preview: `http://127.0.0.1:4194/?qa=1`. Check opening from a learner, racer/track selection, a maths stop, pause/resume, completed race history, a second learner's separate preferences, portrait/landscape touch layouts and an offline reopen. Physical-device performance and audio remain unverified.
