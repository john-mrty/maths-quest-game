# Learning-quality roadmap

Based on the 7 October 2026 playability and learning review. This is a delivery tracker, not evidence of learning effectiveness or certified curriculum coverage.

## Batch 1 — trust and correctness

- [x] Generate place-value tasks from real digit positions; underline the target and repeat it in help.
- [x] Use semantic task identities rather than shared prompt wording to prevent repeated tasks.
- [x] Expand small fraction/shape/factor/time banks to support full 12-question lessons.
- [x] Keep an exhausted set from masquerading as a completed lesson. Speed rounds can finish after every selected fact has been used.
- [x] Make Learn’s “All class topics” include the class catalogue, while Practise respects selected topics.
- [x] Pause Speed round for the workspace, feedback and app backgrounding; close stale workspaces when a lesson ends.
- [x] Keep incorrect-answer explanations until “Continue when ready”; preserve 1,200 ms correct-answer advance.
- [x] Repeat fraction, place-value and shape models in the workspace, including before a tip is requested.
- [x] Delay explicit result captions in arithmetic hints until the final reveal.
- [x] Restore decimal questions in the mixed fraction/decimal topic without misattributing learning evidence.
- [x] Remove unsupported help-based adaptation/Beat Quest adaptation claims.
- [x] Add automated generator, uniqueness, selection, feedback and timer regressions.

Browser checks: complete eight-question first-class fractions round and reward; underlined-digit question and help; persistent correction and usable workspace. Automated checks also cover every topic supplying 12 unique tasks and 2,000 place-value samples.

## Batch 2 — guided learning and mobile usability

- [x] Compact gameplay headers/journey; give maths models and answers priority on phones.
- [x] Implement a guided Learn sequence: question-specific strategy/model, supported attempt, independent attempt. Stay on one topic per round; restore support after struggles and record scaffolded answers as helped. Dedicated worked-example demonstrations remain a future extension.

Verified this batch: responsive browser checks at phone/narrow-phone and desktop sizes; complete eight-question Learn round, stage fading/restoration, independent counts/reward, long fraction wording/reference model, mobile scratchpad and Beat Quest. These are simulated responsive checks, not physical-device or child playtesting.
- [x] Differentiate the initial Practise/Challenge paths: Practise weights first-try errors and help use; Challenge adds inverse/missing-part tasks, practical contexts, missing pattern terms, data comparisons and uncoloured fractions. Both respect the plan; Challenge has no timer and keeps tips available.
- [ ] Extend bespoke reasoning variants to remaining topics (including shapes, time, statistics, algebra and probability); obtain teacher review of the expanded challenge bank.
- [x] Add optional read-aloud for questions and revealed tips, enabled per learner in parent controls (off by default). Browser-provided English voices, replay/stop, maths-symbol text conversion, visual reference descriptions and paused Speed time. Automated speech lifecycle/opt-in tests and mobile playback-control checks passed.
- [ ] Listen to pronunciation on physical iPhone/iPad devices and review with children; voice availability and offline behaviour depend on the browser/device.
- [x] Add early addition/subtraction ten-frames, part–whole and open-number-line models with staged support, matching question and tip numbers. Ten-frames preserve both parts by colour; subtraction supports count-back and count-up difference strategies. Learn fades models after successful attempts.
- [x] Extend multiplication arrays to labelled equal-group models, and distinguish division by sharing from division by grouping, using the same dot language in questions and help.
- [ ] Add base-ten place-value models; teacher-review models and conduct physical-device/child playtesting.
- [ ] Teacher-review the expanded early fraction/shape tasks and class readiness.
- [ ] Simplify onboarding’s redundant final review/CTA transitions.

## Batch 3 — replayable mathematical play

- [x] Turbo Trail survival-race prototype: age-banded questions, drive-through answer numbers, three lanes, gently curving road, progressively shorter approaches, completed-sum counter, first-miss ending, per-learner personal best, central Start driving and New race controls. Hold-Up/W or the touch pedal for sustained acceleration; swipe up for a one-second burst. One pause icon also shows maths support. Original eight-bar chiptune audio remains independent of answers. No ghost opponents, drifting or multiplayer yet; child/device/audio playtesting still required.

Verified 8 October: browser steering, swipe-up acceleration, merged pause/help, first-miss ending, New race restart and per-learner best persistence. Space pauses/resumes from focused accelerator buttons and music checkboxes; the pace meter showed 1.69× after three correct sums. Earlier portrait checks confirmed no horizontal overflow and usable answer/accelerator targets. Automated fact, difficulty-floor, acceleration, Space-focus, scratchpad and audio-lifecycle checks included in the 45 passing checks. Soundtrack composition/range is checked programmatically, not yet aurally evaluated on physical devices.

- [x] Move steering arrows to gameplay edges, add broad touch areas and canvas-half tap steering, retain directional/upward swipes, and use a supplied gameplay image for Turbo Trail’s home tile. Browser-tested broad left/right taps.
- [x] Space captures pause/resume before focused buttons/checkboxes handle it; held-key repeat cannot toggle rapidly. Steepen approach shrinkage from 4.5% to 16% per successful sum, keeping the minimum distance, and show a numeric PACE badge, filling meter and reduced-motion-safe pace-up pulse.
- [x] Give 1st Class a 15% slower base speed and a gentler 10% approach shrinkage per correct sum. Keep acceleration available and all other class pacing unchanged. Per-class regression checks included in 46 passing tests.
- [x] Add optional Restart bridge after a crossing, with new targets and accurate completion totals for repeated bridges. Compact Turbo Trail’s accelerator beside pause, add immediate master mute, match the Driving style select and retain its value per learner. Show answer numbers with each question immediately, include Spacebar in the controls text, and display the selected learner’s personal best on the home tile.
- [x] Hide mobile steering arrow artwork while retaining broad tap targets. Add opt-in calibrated tilt steering, portrait/landscape mapping, smoothing/dead zone, permission handling, missing-sensor fallback and listener cleanup. Keep swipe-up acceleration. Replace separate audio checkboxes with the single mute control. Automated controls checks pass; physical-device tilt testing remains required.
- [x] Replace first-miss endings with three lives per race: visible accessible hearts, three-second equation correction after a miss, continuation at the retained score/pace and journey position, ending after the third miss. New race restores all three lives. Regression checks cover mixed correct/missed answers, correction timing, duplicate-resolution protection and score retention.
- [x] Raise the gap-based pace cap to exactly 4× in Cruise and Race, keeping the existing per-class ramp (gentler for 1st Class). The pace meter reaches 100% at the new cap; all-class regression checks enforce the maximum.
- [x] Remove the optional tilt control and motion-sensor permissions. Mobile continues to use broad tap targets, left/right swipes and swipe-up acceleration, with device-specific instructions.
- [x] Replace Turbo Trail’s boxy kart with a sculpted toy roadster: rounded painted shell, plump wheel arches, curved spoiler, cockpit/windscreen, gold trim and chunky tyres with hubs. Retain bunny, steering and gameplay geometry.
- [x] Clarify unlimited race duration: questions replenish indefinitely and only loss of all three lives ends the run. Add active race duration (excluding paused/hidden time), per-learner longest-race record, completion duration evidence and home-tile record. Regression checks protect long runs and duration persistence.
- [x] Import Turbo Tables as the replacement racing game, retaining its lap-based gameplay. Integrate active learner identity/class, per-profile preferences/fact memory, completed-race learning history, safe frame messaging and offline dependencies. Existing Turbo Trail history is preserved. Automated integration checks pass; visual browser/physical-device checks remain outstanding because the preview connection was unavailable in this session. See `turbo-tables-integration.md`.

- [x] Number Trail supports direct tap/drag selection and a keyboard slider, visible directional tips, green correct-answer validation and 1,200 ms foreground-only auto-progression. Share the Treasure uses draggable gold coins and playful buckets, keeps tap alternatives, supports transfers/returns and uses the same success/advance treatment. Browser-tested direct selection, tips, tray-to-bucket dragging and both next-puzzle transitions.
- [x] Clear scratchpad immediately without confirmation, keeping the workspace open. Cloud Crossing now has a tighter initial camera, no zoom/rotate toolbar or help button, and a ruler containing actual unit cells rather than an extra zero cell. Gesture camera interaction remains available.

- [x] Replace repeated bridge rounds with one bridge followed by a flower-picking chapter: camera follows onto the island, reversible 3D picking and basket previews, keyboard/button alternatives, counting/halves/thirds by class, and completion rewards recorded as two tasks. Browser-tested scene picking, undo, correction and full completion; responsive dimensions checked. Physical-device and child retesting remain outstanding.
- [x] Remove the redundant independent “Try it yourself” panel and add a full counter preview tray with reversible group-labelled counters to Share the Treasure.

- [ ] Varied Cloud Crossing missions, stable/explicit units, bridge markings and transfer questions.
- [ ] Number Trail jump traces and alternative strategies.
- [ ] Share the Treasure animated pool, sharing/grouping tasks and batch moves.
- [ ] Child-friendly counter targets and keyboard alternatives.
- [ ] Meaningful world changes and creative use of rewards.

## Batch 4 — individual progression

- [ ] Shared subskill evidence across quiz and mini-games.
- [ ] Per-fact Beat Quest adaptation, genuine pattern lessons and saved table choices.
- [ ] Prerequisite-aware difficulty, spaced revisits and later-retention checks.
- [ ] Parent summaries distinguishing supported success, independence and retention.

## Batch 5 — curriculum coverage and validation

- [ ] Stage outcome → subskill → question family → game → assessment matrix.
- [ ] Irish primary teacher validation; fill omitted measures/shape/data/fraction families.
- [ ] Physical iPhone/iPad play-tests, accessibility checks and performance checks.
- [ ] Child testing across stages/confidence levels, followed by unseen transfer tasks.
- [ ] Consider Market Day, Shape Workshop and Harbour Planner once their learning objectives are mapped.
