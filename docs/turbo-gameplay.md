# Timed maths boosts and cornering

Questions use invisible checkpoints, four per lap. There are no answer arches, lane billboards or approach cones. The race pauses for a question card with a prominent progress bar that drains from right to left. The player has ten seconds of active question time; pausing the game freezes the countdown. Remaining time is exposed to assistive technology without a visible numeric countdown.

Correct answers earn a boost on resuming. Boost duration scales continuously from 3 seconds for an immediate answer to 1 second near the deadline; top-speed multiplier scales from 1.6× to 1.15×. Answers within three seconds earn two stars. Incorrect answers and timeouts show the correct equation, cancel any existing boost, and slow the car for 2.2 seconds. Each question enters learner accuracy and adaptive practice once; crossing a checkpoint does not score it again. Questions refresh on the next lap.

Normal cornering now introduces a damped body slide, gentle lateral movement and tyre smoke at racing speed, including Easy driving. Manual drift and its charged mini-turbo remain available. Automatic slides settle when steering straightens and do not award a drift bonus.

Regression checks cover answer speed scaling, wrong answers, timeouts, pause timing, checkpoint reuse, expired boost strength and ordinary cornering. Run:

```
deno test --allow-read --import-map=tests/three-import-map.json tests/turbo-gameplay.test.mjs tests/turbo-visuals.test.mjs tests/turbo-tables.test.mjs tests/service-worker.test.cjs
```

All 19 checks pass. Browser inspection confirmed the visible countdown, correct-answer boost confirmation, timeout correction and resumed racing without arches, with no console errors. The prior visual polish is included in this working tree; cache version 63 refreshes both sets of changes. Physical-device handling and performance still need playtesting.

The later driving-help adjustment replaces automatic lane-following with direct player steering plus 30% guidance and a small edge recovery assist. Automatic acceleration and gentle corner braking remain. The player can still initiate manual drifts. Two additional checks verify partial guidance/manual control and the progress bar's decreasing fraction while respecting pause.
