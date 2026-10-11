# Projecting a robot route

In the city, choose **Project robot line** (the route icon in the map toolbar).
Opening this mode completes any unfinished plan to the studio, using the same
planner as **Start robot**, without starting the simulation. The projection uses
the simulation's actual curved trajectory, including the selected turn radius.

Review **Barcode event legend**, then choose **Start projection**. Only the black
line and its black transverse event bars remain on a white background. Fullscreen is
requested when supported; the clean display also works without it. These colours
are fixed independently of the app theme. Escape or a tap
on the projection restores the controls; **Back to city** leaves projection mode.

The route is fitted without stretching, and does not move with the virtual robot.
Adjust the projector's size, focus and alignment on the table, and calibrate the
physical robot's sensors, speed and bar-duration thresholds using that projected
size and polarity. Hardware reading has not been verified by the software tests.

## Barcode format and commands

The format follows [RIX Living Lab's line-following barcode article](https://rixlivinglab.com/2026/05/18/teaching-a-line-following-robot-to-read-barcodes/):
one double-width start bar, four data bars in travel order, then one double-width
stop bar. Thin data bars represent 0; medium bars represent 1. Relative widths
are 1:2:4. These are transverse strips, rather than QR codes. The article uses
black tape on white; the projection always uses that same polarity.

| Bits | Event |
| --- | --- |
| 0000 | Start journey |
| 0001 | Raised curb |
| 0010 | Bridge or steps |
| 0011 | Narrow passage |
| 0100 | Pelican crossing |
| 0101 | Route cues |
| 0110 | Train boarding |
| 0111 | Bicycle |
| 1000 | Music discovery |
| 1001 | Art discovery |
| 1010 | Harmony discovery |
| 1011 | Colour discovery |
| 1100 | Studio arrival |
| 1101 | Ordinary junction arrival |

Codes identify event types consistently across city remixes. A junction with
several events has consecutive separate barcodes. Each complete barcode is placed
on a straight section near its junction, with six parallel bars perpendicular to
the line and clearance from bends. Codes stay in travel order. When space is
limited, a common smaller bar/line width preserves timing ratios across the route.
Routes without enough straight track show an explanation instead of placing
barcodes on curves or overlapping them.

The legend lists the junction and event for each code in travel order. Map these
codes to actions or audio tracks in the physical robot's firmware. The application
does not connect to the robot or send commands, and the displayed codes do not
automatically synchronize the physical and simulated robots.
