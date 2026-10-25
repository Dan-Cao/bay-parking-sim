# Bay Parking Simulator

**▶ Try it: https://dan-cao.github.io/bay-parking-sim/**

A browser-based 3D trainer for learning to bay park, built for instructor-led practice on one keyboard. The learner drives with WASD; the instructor can pause at any time, drag cars around to set up a situation, and hand the keyboard back.

The car pivots about its rear axle with a realistic turning circle, so reference points, the rear wheels cutting in and the gap you need to swing out all behave like the real thing. When the car stops in a bay, a park checker judges it, the way an instructor would.

## Running it

The easiest way is the [published page](https://dan-cao.github.io/bay-parking-sim/): nothing to install, just open it in Chrome, Edge or Firefox.

To run it locally, there's no build step, but the code is split into JavaScript modules, which browsers won't load from a page opened straight from disk. Serve the folder instead:

1. Download or clone this folder.
2. In the folder, run:

   ```bash
   python -m http.server 8000
   ```

3. Go to http://localhost:8000 in Chrome, Edge or Firefox.

You need an internet connection, because the 3D library ([three.js](https://threejs.org)) loads from a CDN.

## How a lesson works

1. **Pick a scenario** from the picker when the page opens. You can reopen it with **Scenarios** in the top right.
2. **Drive into a bay.** The car only moves while W (or S) is held and stops as soon as it's released.
3. **Stop.** About 3 seconds after the car stops in a bay, the result appears. Move the car and it disappears; adjust and stop again to have it re-checked.
4. **Practise exiting.** Pull out of the bay and drive to the blue **EXIT** marker without touching anything.
5. **Rearrange (instructor).** Press **E** for edit mode, move cars, change the layout, then press **E** to drive again.

## Controls

| Key | Action |
|---|---|
| W | Drive forwards (or accelerate in the selected gear) |
| S | Reverse in arcade mode, brake otherwise |
| Space | Brake |
| A / D | Turn the steering wheel left / right |
| C | Centre the steering wheel |
| R | Change gear (manual and automatic modes only) |
| V | Camera: top-down → chase cam → driver's seat |
| Mouse | Look around in chase cam and driver's seat: click to capture the mouse, Esc to release it |
| X | Reset the view to straight ahead / behind the car |
| + / − / mouse wheel | Zoom |
| M | Show or hide the mirror and rear-camera strip |
| E | Edit mode (instructor) |
| Esc | Settings |
| H | Show or hide the controls panel |

### Phones and tablets

On a touch screen the keyboard help is replaced by on-screen controls. They appear on phones and tablets straight away, and on a laptop with a touchscreen as soon as you touch it. Using the mouse or a key brings the keyboard help back.

| Control | Action |
|---|---|
| ◀ / ▶ (bottom left) | Hold to turn the steering wheel |
| Centre | Centre the steering wheel |
| ▲ Forward / ▼ Reverse (bottom right) | Hold to drive; let go to stop. In manual and automatic it's **Go** plus a **Gear** button |
| View · Reset view · Mirrors | Change camera, reset the look direction, show or hide the mirror strip |
| Drag the scene | Look around in chase cam and driver's seat |
| Pinch | Zoom |

In edit mode, drag things with a finger. **Snap ⟲ / ⟳** line the selected item up with the bays, and untick **Snap dropped cars into bays** to place cars freely (the touch version of holding Alt). On a narrow screen the edit panel sits along the bottom. Landscape gives the most room, though portrait works too.

### Views

- **Top-down:** an overhead view of the whole car park section. Best for learning where the car is relative to the lines.
- **Chase cam:** a third-person view from behind the car, like in driving games. Move the mouse to look around. The view stays where you put it until you press X, and it rises over parked cars rather than going through them.
- **Driver's seat:** a right-hand-drive seat with working wing mirrors, a rear-view mirror and a reversing camera on the dash. The mirror strip along the top is on by default here, because the real mirrors are small on screen.

## Scenarios

| Scenario | What it's for |
|---|---|
| Empty lot | One row of bays and nothing else. Learn the reference points. |
| Between two cars | Standard UK bays with neighbours parked straight on both sides. |
| Tight / wonky neighbour | One neighbour is over the line and at an angle, so the gap is smaller than it looks. |
| Angled bays | 45° bays on both sides of a one-way aisle. |
| Narrow aisle | A 4.6 m aisle with walls and pillars, like a multi-storey. Little room to swing out. |

## The park checker

| Check | Pass | Warning | Fail |
|---|---|---|---|
| Wheels | Tyres clear of the side lines | A tyre on a line | A tyre across a line |
| Body | Whole body and mirrors inside the side lines | | Anything over a line |
| Length | Neither bumper past the front or back line | | A bumper past a line |
| Angle | Within 5° of the bay | | More than 5° off |
| Contacts | No contact during the attempt | | Any contact |
| Driver's door | At least 60 cm to open the door | Less than 60 cm | |

Each check shows the measured value, and problems are highlighted on the car in the scene. Angled bays are judged against their own angle.

Touching another car, a pillar or a wall stops the car, flashes the contact point and counts as a fault. You can back off and carry on.

## Edit mode (instructor)

Press **E**. Driving pauses and the view switches to top-down.

- **Drag** any car, pillar, wall, the learner's car or the EXIT marker. Grabbing never makes it jump.
- Dropped cars **snap** into the nearest bay. Hold **Alt** while dropping to place one freely, for example over the line.
- **Rotate** while dragging with **[ ]** or the mouse wheel. Hold **Shift** to snap to the bay angle.
- **P** moves the learner's car to the cursor.
- **Add** hatches, sedans, SUVs, vans, pillars and walls from the side panel. **Del** removes the selected one.
- **Layout:** one or two rows, bays per row, bay angle (90°, 60°, 45°), bay width and length, aisle width, kerb or wall at the back, pillars.
- **Ctrl+Z** undoes. **Reset** returns to how things were when you last left edit mode. **Reload preset** starts the scenario again.

## Settings (Esc)

- **Car:** Alfa Romeo MiTo (default), small hatch, sedan, SUV or custom. Every dimension can be edited, including the turning circle and steering turns lock-to-lock, so you can match the car you learn in.
- **Gearbox:** arcade (default: W forwards, S backwards), manual (1 / R) or automatic (D / R). In manual and automatic, being in the wrong gear moves the car the wrong way, like the real car.
- **Steering:** the wheel holds its position (default) or self-centres.
- **Reference markers:** optional dots for the mirrors, driver's shoulder, rear axle and bumper corners. They light up when they line up with a bay line.
- **Display and sound:** mirror strip per view, rear parking-sensor beeps and contact sounds, UI size for a laptop or a TV.

Settings are saved in the browser. Scenarios aren't saved; use the presets and edit mode.

### About the MiTo figures

The default car uses approximate published figures: 4.06 m long, 1.72 m wide (1.94 m with mirrors), 2.51 m wheelbase, 11.3 m kerb-to-kerb turning circle and about 3.6 steering turns lock-to-lock. Check them against your own car's handbook and adjust them in Settings if needed.

## Test page

Open `index.html?test` to run the checker's test scenes: cars placed at known positions (2° and 6° crooked, tyre on and over a line, mirror over a line, bumper past a line, door gaps, contacts, turning circle), with expected and actual results side by side. Click a row to see the scene.

## Code layout

No build step: `index.html` loads `src/main.js` as an ES module, and three.js comes from a CDN via an import map.

| File | What's in it |
|---|---|
| `index.html` | Page markup: HUD, edit panel, scenario picker, settings |
| `style.css` | All styling |
| `src/main.js` | Entry point: the main loop and boot |
| `src/state.js` | Shared mutable state (`S`): the scenario, steering, camera mode, current attempt and so on |
| `src/config.js` | Constants, car and scenario presets, saved settings |
| `src/geometry.js` | Pure 2D maths: car dimensions, the bicycle model, bay layout |
| `src/scene.js` | three.js renderer, lights, cameras, materials, mesh helpers |
| `src/carModels.js` | Exterior car meshes and the top-down overlay |
| `src/interior.js` | The driver's-seat interior |
| `src/world.js` | The learner car, the static scene and scenario loading |
| `src/checker.js` | Collisions, the park checker and the result panel |
| `src/driving.js` | Driving the car each frame |
| `src/cameras.js` | Top-down, chase, driver's-seat and mirror cameras, and the mirror strip |
| `src/hud.js` | Gear and steering HUD, controls help |
| `src/input.js` | Edit mode, mouse, touch gestures and keyboard |
| `src/touch.js` | On-screen touch controls, and switching between them and the keyboard help |
| `src/modals.js` | Scenario picker and settings dialogs |
| `src/audio.js` | Parking-sensor beeps and the contact bump |
| `src/tests.js` | The `?test` page |
