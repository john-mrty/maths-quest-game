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

## October mobile and difficulty update

Landscape phone feedback sits at the bottom centre, away from the horizon. Kart paint uses a soft satin finish. Racing setup displays the active learner’s latest avatar or custom profile photo. Tilt steering is available beside Driving help on touch devices, remembers the learner’s preference and requests motion access from the tap. The embedded frame delegates accelerometer and gyroscope access; missing readings or denied permission restore button controls. Tilt recentres after rotating the device.

From 2nd class, opponents have higher answer accuracy and pace, brake less on curves and ease off less when ahead; each later class increases pace and accuracy further. 1st class keeps its existing settings. All racers still pause for maths questions. Physical mobile motion access and subjective race balance need device playtesting.

## Natural cornering and touch pad

Drifting now comes from speed and steering rather than holding a button. The car slides progressively into bends and restores grip when steering straightens. Removed the drift button, hop trigger, manual drift charge and mini-turbo release. Keyboard steering/acceleration and gamepad steering/acceleration remain unchanged.

Touch devices get a circular left thumb pad. Holding anywhere on it supplies full acceleration, including its centre and bottom half; sideways movement provides analogue steering with a centre dead zone. Pointer capture keeps the press active outside the circle. Lifting, cancellation, lost capture, window blur, a maths question or pause clears it. Additional fingers cannot steal the pad. Tilt steering still works, with the pad serving as a forgiving accelerator. Item and reverse remain on the right. The pad is hidden without touch capability.

## Race flow and visual polish

Paired lilac roadside rings and a compact “Maths boost ahead” cue announce approaching questions. After the correction/reward card, the whole race remains paused for 0.7 seconds with a small “Ready…” cue; players can reposition or hold their controls before simulation eases back in. Pausing freezes this recovery timer. The large duplicate result toast is suppressed during recovery.

Drifting remains automatic. Camera follow now responds to the actual corner slide, with quiet filtered tyre scrub and a bounded pool of fading tyre marks. Reduced-motion settings continue to suppress camera roll and drift lag. The road is darker, and kart contact shadows are stronger. Empty item slots and unavailable item buttons are hidden; shield changes refresh correctly. Embedded play uses the outer pause button only. Cache version 71 includes these changes and the pending tilt/rotation cleanup.

## Avatar racers and calmer starts

The four selectable racers keep their original identities: Pip the fox, Momo the panda, Zip the robot and Luna the cat. Heads are 20% larger, with larger expressive eyes, natural blinking, sculpted cheek and crown tufts, cat face markings, muzzle freckles, panda bow and robot side panels/vents. Satin paint, brighter kart colours, cream bonnet stripes and rear number badges improve recognition. Two male and two female selectable characters, existing racer IDs and saved selections are preserved.

The camera orbit finishes in the stationary chase position before GO. The grid and lap origin are rebased onto each circuit’s gentlest sustained segment, and the automatic launch boost is removed. Auto acceleration is always on in setup, with Down/S or the touch Brake button slowing the car to a stop. Driving help adds guidance while respecting the brake. Spacebar uses an item. The touch pad now labels steering only, and tilt needs no GO button. The first answer option uses pale pink. The additional 0.7-second recovery pause after answer feedback is removed.

Checks cover camera continuity, forward track direction at every grid, two male and two female original selectable racers, finite kart geometry, auto acceleration, Down braking, Spacebar items and immediate return from answer feedback. Visual appearance and physical touch/tilt feel need review on device. Cache version 73 refreshes the app.
