# Maths Quest

**Build maths confidence, one adventure at a time.**

Maths Quest is a free, browser-based collection of maths games and supported practice for children in **1st–6th Class**, based on the Irish primary maths curriculum. Turbo Tables leads the games collection, alongside Beat Quest and mini-games, with Learn, Practise and Challenge available for focused learning.

**[Play Maths Quest](https://play.maths-quests.com/)** · [About the game](https://maths-quests.com/) · [Open Turbo Tables](https://play.maths-quests.com/?game=turbo-tables)

No account or download is needed to begin. Guest progress stays on the device; an optional parent account can save profiles and progress across devices.

## Turbo Tables

A colourful 3D kart racer that combines three-lap races with class-based maths questions. Despite the name, it includes addition, subtraction, multiplication and division, with available operations and number ranges matched to the learner’s class.

- **Four original racers:** Pip the fox, Momo the panda, Zip the robot and Luna the cat.
- **Three circuits:** Sunny Meadow, Candy Canyon and Moon Loop, with collectible items and computer-controlled opponents.
- **Maths boosts:** racing pauses at checkpoints for a question with ten seconds to answer. Correct answers earn a turbo boost; faster answers earn stronger boosts. Incorrect answers and timeouts show the correct equation before racing resumes with a short slowdown.
- **Personal practice:** question selection revisits facts that need more work. Results show accuracy, the race’s questions and facts to practise next.
- **Per-learner saving:** racer and track choices, fact practice and completed races belong to the active learner. Race results feed into their existing progress and completed-quest history.
- **Class-based driving:** younger classes receive more guidance, while later classes have more demanding racing. Acceleration is automatic and cornering produces natural slides.
- **Desktop and touch controls:** keyboard steering, Space to use an item, touch steering, optional Tap to steer and optional tilt on supported devices. Desktop answer shortcuts use 1, 2 or 3.
- **Device-aware presentation:** automatic Full, Balanced and Light graphics, optional haptics where supported, sound controls and pause handling.

Racing is a timed challenge. Learners can also choose supported practice elsewhere in Maths Quest when they want more time to think. Race positions are against computer-controlled opponents; there is no online multiplayer or public leaderboard.

An **opt-in Duo controller layout preview** is available at [`?game=turbo-tables&controls=duo`](https://play.maths-quests.com/?game=turbo-tables&controls=duo). This is an alternative controller layout, not a two-player mode, and is separate from the default controls.

## More ways to play

### Beat Quest

Individual times-table practice that builds a musical track as accurate streaks grow: drums, bass, chords and melody. Table choices have class-aware defaults, with untimed Discover and practice options plus a parent-controlled timed Speed round.

### Mini-games

Open Mini-games from the learner home to explore:

- **Cloud Crossing:** build bridges by combining lengths to reach the other bank exactly. Crossings use addition for 1st–2nd Class, equal groups for 3rd–4th Class and quarter-unit fractions for 5th–6th Class. Rotate, tilt and zoom the 3D scene using touch, mouse or on-screen controls. Completing all three crossings earns a collection decoration and records a completed result.
- **Number Trail:** follow class-based number sequences with visual feedback and optional help.
- **Share the Treasure:** explore equal sharing through interactive counters, class-based number ranges and optional tips.

Learners also have a personal collection of decorations earned through play.

## Learn, Practise and Challenge

- Create separate learner profiles using a first name or nickname, class and illustrated avatar or optional profile photo.
- Tailor each learner’s topic plan to what they have covered at school.
- Choose a focused topic in Learn or Practise, or let the app select from the learner’s plan.
- Revisit tricky topics and keep familiar skills fresh, with questions and visual models suited to the class and topic.
- Use **Work it out**, a question-specific grid-paper scratchpad that brings the question, progressive tips, visual models and similar examples together with pencil and eraser tools. Draw using a finger, stylus or mouse.
- Explore models including ten-frames, part–whole representations, number lines, equal groups and fractions.
- Enable optional question and tip read-aloud for individual learners from the grown-ups area, where browser speech support is available.

## Grown-ups, saving and privacy

The protected grown-ups area provides learner management, topic progress, completed-quest history and controls for sound, celebrations, quest length, read-aloud and the timed Beat Quest round.

**Guest use:** profiles and progress are saved in the browser on the current device. Clearing browser storage can remove these local saves.

**Optional parent accounts:** Google sign-in can save learner profiles, preferences, photos and completed results privately across devices. Changes made offline stay on the device until they can sync. Active quests and scratchpad drawings are not uploaded or restored as in-progress sessions. Account controls include signing out, adding guest profiles and deleting the account. Apple sign-in is not currently offered.

The optional account backend uses Supabase; a self-hosted copy needs its own configuration. See [parent-account setup and verification](supabase/SETUP.md).

There is no advertising or public ranking of children. Cookie-free analytics count anonymous usage events; learner names, photos, answers, scores and progress are not sent to analytics. Account saving is separate from analytics and does transfer the saved family data described above.

## Browser, installation and offline use

Maths Quest is a static web app with no build step. It runs in a browser on computers, tablets and phones, and can be installed through the browser’s **Install app** or **Add to Home Screen** option.

A service worker caches the app shell and game assets for offline use after they have been downloaded. First use, sign-in and cross-device saving require an internet connection. The 3D games require WebGL; physical-device performance, motion permissions and browser support can vary. Turbo Tables adjusts rendering quality automatically without changing maths difficulty.

## Run locally

Clone this repository and serve it over HTTP rather than opening `index.html` directly:

```sh
git clone https://github.com/john-mrty/maths-quest-game.git
cd maths-quest-game
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/). HTTPS or localhost is needed for service-worker installation. Guest play works without an account backend; configure your own backend separately if you need sign-in.

## Checks

Regression checks cover learning, visual models, account saving, mini-games, race maths and physics, controls, adaptive graphics and offline caching.

Run the CommonJS suites with Node.js:

```sh
node --test tests/*.test.cjs
```

Run the ES-module suites with Deno, using the bundled Three.js import map:

```sh
deno test --allow-read --import-map=tests/three-import-map.json tests/*.test.mjs
```

These checks complement browser and physical-device playtesting, especially for touch/tilt controls, audio, haptics and performance. They do not establish learning outcomes or guarantee a particular device’s frame rate.

## Implementation notes and further reading

- The main app uses HTML, CSS and JavaScript, with bundled dependencies rather than a package-install/build pipeline.
- Turbo Tables runs in an isolated iframe and exchanges validated messages with the host so choices and completed results stay attached to the active learner.
- Three.js and its licences are bundled locally: Turbo Tables uses its own version under `turbo-tables/vendor/three/`, while Cloud Crossing uses `vendor/`.
- [Turbo Tables integration](docs/turbo-tables-integration.md)
- [Turbo Tables gameplay and controls development notes](docs/turbo-gameplay.md) — chronological notes; later entries supersede earlier behaviour.
- [Learning-quality roadmap](docs/learning-quality-roadmap.md)
- [Optional parent-account setup](supabase/SETUP.md)

Maths Quest is independently developed. Its curriculum basis does not imply endorsement by NCCA or the Department of Education. [Read about the national primary maths curriculum](https://ncca.ie/en/primary/primary-developments/primary-curriculum-redevelopment-2015-2025/redevelopment-of-primary-curriculum-areas/stem-education/primarymaths/).
