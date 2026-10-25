# Bay Parking Simulator — Spec v1 (draft for review)

A browser-based 3D bay parking trainer for teaching a learner driver, used in an instructor-led lesson on one keyboard. Defaults to a top-down view; first-person (mouse-look) included in v1.

---

## 1. Context & constraints

| Item | Decision |
|---|---|
| Platform | Browser page, local files (open `index.html`) |
| Rendering | Three.js (3D from the start). "Top-down" = overhead camera on the 3D scene |
| Internet | Allowed — Three.js loaded from CDN |
| Browsers | Chrome / Edge, Firefox |
| Screens | Laptop and TV/monitor — responsive, scalable UI |
| Region | UK/NZ: drive on the left, right-hand-drive car |
| Saving | None. Presets + ad-hoc edits only |
| Users | One keyboard. Learner drives; instructor pauses into edit mode to rearrange |

---

## 2. The car

### 2.1 Default: Alfa Romeo MiTo (manual)
Approximate specs — **please verify against your car / V5C / handbook**:

| Spec | Value |
|---|---|
| Length | 4.063 m |
| Width (body) | 1.720 m |
| Width (incl. mirrors) | ~1.94 m |
| Height | 1.446 m |
| Wheelbase | 2.511 m |
| Turning circle | **11.3 m** (manufacturer figure) |
| Steering lock-to-lock | **~3.6 turns** (~1.8 each way); adjustable |
| Doors | 3-door (long driver's door) |

### 2.2 Other presets
Small hatch, sedan, SUV, plus **custom**: length, width, mirror width, wheelbase, turning circle, lock-to-lock turns.

### 2.3 Transmission modes (selectable in settings)
- **Manual (option):** gears **1st** and **R** only. `R` toggles 1 ↔ R. No clutch, no stalling, no neutral.
- **Automatic:** **D** and **R**. `R` toggles D ↔ R.
- **Arcade (default):** W = forward, S = reverse, no gears.

In Manual/Automatic, W = accelerate in the selected gear's direction, S = brake. Being in the wrong gear moves the car the wrong way, exactly like the real car.

### 2.4 Driving feel
- Car moves **only while W is held**. Release = stop.
- Speed: **~7.5 km/h, constant**, same forward and reverse.
- Steering: A/D turn the wheel gradually. Two modes, toggled in settings:
  - **Holds position** (wheel stays where you leave it)
  - **Self-centering**
- `C` snaps the wheel back to centre.
- Kinematic bicycle/Ackermann model: the rear wheels track inside the fronts (cut-in), and the car pivots about the rear axle.

---

## 3. Controls

| Key | Action |
|---|---|
| W / S | Accelerate / brake (or fwd/back in arcade mode) |
| A / D | Steer left / right |
| Space | Brake |
| R | Toggle gear (1↔R or D↔R) |
| C | Centre steering |
| V | Cycle camera: top-down → chase cam (third-person, behind the car) → first person |
| + / − (and scroll) | Zoom (top-down) |
| E | Toggle Edit mode (pauses driving, forces top-down) |
| P | Place learner's car (in edit mode) |
| Ctrl+Z | Undo (edit mode) |
| Esc | Settings |
| Mouse | Look around (first person only); drag/select (edit mode only) |

Keys must not get "stuck" when the window loses focus: on blur, all keys are released.

---

## 4. Views

### 4.1 Top-down
- **Top-down fixed** (whole car-park section) plus a **chase cam**: a third-person view behind and above the car that swings round smoothly as it turns (like Forza/GTA). Zoom works in both.
- Semi-realistic look: tarmac texture, painted lines, shadows, car models with visible headlights/tail-lights and windscreen so the facing direction is obvious.
- Front wheels visibly turn to their real angle.

### 4.2 Insets (strip along the top)
`[ Left mirror | Rear camera | Right mirror ]`, rendered as real 3D mirror/camera views.
Shown by default in the driver's seat view (the 3D mirrors are too small to read); hidden by default in top-down. `M` toggles it for the current view.

### 4.3 First person (v1, basic)
- Right-hand driver's seat at realistic eye height (~1.1 m).
- Mouse-look, able to turn far enough to look over the shoulder out the rear window.
- Working wing mirrors and rear-view mirror.
- A/B/C pillars and dashboard block the view like the real car.

### 4.4 Always-visible HUD
- **Current gear**: large (1 / R, or D / R)
- **Steering wheel widget**: shows turns from centre (e.g. "1½ turns left")
- **Mode indicator**: DRIVE / EDIT
- **Key help**: small, collapsible

### 4.5 Reference markers (off by default, each can be turned on in Settings)
Car-relative dots that grow and turn yellow when lined up with a bay line (no guide lines drawn):
- Side mirrors
- Driver's shoulder / B-pillar
- Rear axle (pivot point)
- Front and rear bumper corners

---

## 5. Car park & scenarios

### 5.1 Layout
- Bays: **UK standard 2.4 m × 4.8 m**, adjustable width and length.
- Bay angle: 90°, 60°, 45°.
- Double rows facing across an aisle, aisle width adjustable, number of rows adjustable.
- Objects: kerbs/walls at bay ends, pillars between bays.

### 5.2 Presets (scenario picker shown on launch)
1. **Empty lot**: one clear row, no other cars
2. **Between two cars**: target gap with neighbours parked straight
3. **Tight / wonky neighbour**: one neighbour over the line or angled
4. **Narrow aisle**: little room to swing out

### 5.3 Maneuvers supported
Reverse into a bay, forward into a bay, angled bays (either direction), exiting a bay.

---

## 6. Edit mode (instructor)

Entering edit mode (`E`) pauses driving and switches to top-down.

- **Drag** cars to move them. **No jump on grab**: the car keeps its offset from the cursor.
- **Rotate** selected car (scroll / Q-E). Hold Shift to snap to bay alignment.
- **Snap to bay**: dropped cars snap neatly into the nearest bay; hold **Alt** to place freely (wonky).
- **Add/delete** parked cars: hatch, sedan, SUV, van.
- **Add/remove** pillars and walls.
- **Layout params**: bay size, angle, aisle width, rows.
- **Place learner's car** anywhere at any angle (`P`).
- **Place exit target**: a marker in the aisle (e.g. the end of the row or the exit) that she must reach when practising exits. Each preset has a default position.
- **Undo** (Ctrl+Z) and **Reset scenario**.

---

## 7. Collisions & sound

- Collision uses the **exact car outline including mirrors** (not a bounding box).
- On contact the car **stops**, the contact point flashes, and the contact is recorded as a fault. She can back off and continue.
- No false contacts in a gap of 5 cm or more.
- **Sound**: rear parking-sensor beeps (rear only, faster as an obstacle gets closer) and a bump sound on contact. No front sensors, even when forward parking into a wall.

---

## 8. Park checker

### 8.1 Trigger
Automatic: the car has been **stopped for ~3 s** while **substantially overlapping a bay**. The judged bay is auto-detected as the most-overlapped bay. Brief mid-maneuver pauses outside a bay don't trigger it. After a result, moving the car hides it; adjusting within the bay and stopping again re-checks it (contacts from the attempt are kept).

### 8.2 Checks

| Check | Pass | Warning (amber) | Fail |
|---|---|---|---|
| Width: wheels | Tyres clear of side lines | A tyre resting **on** a line | A tyre across a line |
| Width: body | Whole body **and mirrors** inside side lines | — | Any body/mirror over a line |
| Length | Whole car within bay length (neither bumper past front or rear line) | — | Either bumper past a line |
| Angle | ≤ 5° from bay axis | — | > 5° |
| Contacts | None this attempt | — | Any contact |
| Driver's door room | ≥ 60 cm to the next obstacle on the driver's (right) side | < 60 cm | — |

The same checks apply to forward, reverse and angled parks, however she got there. For angled bays the angle check is ≤ 5° from that bay's own axis. Shunts (direction changes) are not counted.

**Exiting a bay** passes when any part of the car reaches the **exit target marker** with no contact on the way. Angle and lane position aren't judged. An exit attempt begins when the car starts inside a bay.

### 8.3 Result display
- Each check ✓ / ⚠ / ✗ with the measured value (e.g. "3.2°", "48 cm").
- Visual explanation in the scene: the offending tyre or corner highlighted, the crooked side shown.

---

## 9. Acceptance criteria

### Driving accuracy
- [ ] At full lock the MiTo's path matches its real turning circle within **±5%**.
- [ ] The steering widget's lock-to-lock turns match the real car, so "one turn left" means the same in sim and real life.
- [ ] Rear wheels visibly cut in relative to the fronts.
- [ ] Constant ~7.5 km/h while W is held, and the car stops immediately on release.
- [ ] Wrong gear moves the car in the gear's direction, and the gear display makes it obvious why.

### Views
- [ ] The direction the car faces and the angle of the front wheels are never ambiguous in top-down.
- [ ] Mirror and rear-camera insets show the correct scene in real time.
- [ ] First person: correct RHD seat, mirrors work, over-shoulder look is possible, pillars block the view.

### Checker (deal-breaker: no false passes or fails)
- [ ] The checker's verdicts match the instructor's judgment on all test scenes.
- [ ] A hidden **test-scenes page** places cars in known positions (2° off, 6° off, tyre on line, tyre over line, mirror over line, bumper past line, door gap 55 cm / 65 cm, etc.) and shows the expected vs actual result for each.

### Editing (deal-breaker: not fiddly)
- [ ] Grabbing a car never makes it jump.
- [ ] Edit mode is always top-down.
- [ ] Snap-to-bay places cars cleanly; Alt allows free placement.
- [ ] Undo and reset work for every edit type.

### Robustness
- [ ] Smooth **60 fps** on a typical laptop's integrated GPU, including the 3 insets.
- [ ] No broken layout on window resize or fullscreen, and readable on a TV.
- [ ] No stuck keys after focus loss.
- [ ] Works in Chrome, Edge and Firefox.

### Definition of done
- [ ] All four maneuvers (reverse, forward, angled, exit) can be performed and are judged correctly.

---

## 10. Out of scope for v1
- Clutch, stalling, hill starts, full gearbox
- Saving or exporting scenarios
- Moving traffic or pedestrians
- Ghost replay, predicted path overlay, rewind
- Scoring, attempt history, tips, shunt count
- Multi-device / remote instructor control

---

## 11. Open questions
None. Resolved in review:
- MiTo specs accepted: 11.3 m turning circle, treated as **kerb-to-kerb** (outer front tyre path); ~3.6 turns lock-to-lock.
- Shunt count dropped.
- Angled-bay tolerance: 5° from the bay's own axis.
- Rear parking sensors only.
- Exit success = reaching an instructor-placed target marker without contact.
