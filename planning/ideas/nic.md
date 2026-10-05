Different Robots, Different Routes
How do different ways of moving, sensing and communicating change how we
experience the world?
Basic Idea
Environments, technologies and interfaces are often designed around assumptions
about how people move, sense, communicate and interact. But what happens if you
change those assumptions?
Different Robots, Different Routes is an interactive experiment combining inclusive
robotics, sensory and participatory research, art and music. Visitors create a robot,
combining different ways of moving (through actuators), sensing, communicating
(e.g. speech, music) and then discover how those characteristics interact with the
environment around it. There is no normal robot and no single best solution.

Scientific question
What happens when different robots experience the same world? More specifically,
is a successful interaction determined by the capabilities of the robot, or is it the
design of the environment or perhaps the relationship between the two?
Visitors could explore this idea experimentally by making a prediction, testing it out
with the robots, changing something (e.g. robot sensors) and testing again.

Research basis
The idea draws upon inclusive human–robot interaction, accessible technology,
sensory experience and participatory/co-design methods.
The inclusive robotics research asks how people might interact with robots in ways
that go beyond conventional interfaces and commands. Different people may use
speech, gesture, movement, sound, touch, symbols or other forms of communication
(make up something new). This raises a wider scientific and design question - rather
than expecting everybody to adapt to a technological system, how can systems and
environments accommodate different ways of interacting?
RIX co-researchers bring lived experience and sensory, creative and participatory
methods to investigating these questions. Their involvement helps determine the
challenges, environments and accessible ways in which visitors encounter the
science.
The visitor journey (Based upon Kate&#39;s suggestion)

1. Create the robot
Visitors can name or personalise a robot and select a combination of capabilities
relating to movement, sensing and communication using th evariety of sensors,
actuators etc.
2. Predict what will happen
Visitors examine an environment containing features such as different types of
surfaces, different types of routes (e.g. simple, complex), obstacles, sensory signals
or blocked pathways and predict how their robot will respond.
3. Test the robot out by sending it into the world
Visitors can program (not sure how yet, but perhaps a simplified programming
interface, like the four button controller), guide or interact with the robot as it attempts
the task. Its particular movement, sensing and communication capabilities affect
what happens to it as it tried to move from a start position to an end location.
4. Redesign the world in some way
Rather than fixing the robot, visitors can alter the environment by moving an
obstacle, widening a route, adding a sensory cue, changing a surface or providing
another means of communication. What I&#39;m trying to get at here is some slight
modification of the environment that will help the robot achieve its &#39;goal&#39;. (i.e.
modifying the environment to make it more accessible).
They can then test the same robot again, and it follows this cycle:
PREDICT → TEST → OBSERVE → REDESIGN → TEST AGAIN

5. Turn the journey into music?
The robot&#39;s movements and encounters generate musical information. Visitors add
their own contribution using accessible interfaces (not quite sure how at this stage)
including movement, sound or potentially head and facial movements. Different
robots and different people therefore contribute different elements to a shared
composition.

What will visitors discover?
The same environment does not work in the same way for every system. A robot that
encounters a barrier in one environment may work successfully when the
environment changes. Visitors therefore discover that an apparent limitation does not
necessarily lie within the robot itself. Its ability emerges from the relationship
between the robot, its interface, the task and the environment it&#39;s in.
Visitors will also discover that different ways of moving, sensing and communicating
do not simply create different challenges. They can produce different creative
possibilities.

Take-home message
There isn&#39;t one right way to move, sense, communicate or create. When we change
the environment, we change who can participate and what becomes possible.

How does this meet the selection criteria?
Quality and cutting-edge science: It builds on current research in inclusive HRI,
participatory research and sensory objects design, asking a genuine research
question about the interaction between robot capabilities, communication and
environment, rather than simply demonstrating robots. Instead of asking how
humans can better communicate with and adapt to robots, it investigates how robot
capabilities, human communication and environmental design can be considered
together as an interacting system.
Interactive and hands-on elements: Visitors actively create, predict, program/test,
observe, redesign and retest. They effectively become co-researchers conducting a
small experiment rather than watching a demonstration.
Relevance and storytelling: The robot&#39;s journey provides an easily understood
story through which visitors encounter much bigger ideas about accessibility, barriers
and participation. The final music activity gives the journey a memorable creative
conclusion - difference can generate new possibilities, not merely difficulties.
Feasibility: The concept can be built around existing RIX expertise, robots and
research methods, with modular activities that can be tested and refined before the
exhibition. The basic experiment does not require technically complex robotics to
communicate the science effectively.


Email with zen :

I really like the direction you are suggesting for the RixBot. Having the robot communicate in both directions with a central machine makes a lot of sense to me, particularly if we want to keep the individual robots relatively simple while giving them much richer behaviour. I don’t see moving some of the functionality away from the robot as a disadvantage at all. In fact, for this application it potentially gives us far more flexibility.
The idea of the RixBot reporting events back to a central system, which then manages game state, audio, video, screen information and the robot’s character/personality, sounds very promising. It also means that the physical robot does not have to carry all of the processing needed for these interactions. I particularly like the possibility of several RixBots interacting with the same environment and central system. If they could be made smaller, then you could potentially have many of them running at once, rather than limiting to just a few users at a time.
The Bluetooth side should be quite feasible. The robot can support multiple Bluetooth connections, so we are not necessarily restricted to the existing controller-to-robot communication. We would obviously need to work out the most reliable architecture, but I agree that much of this should be achievable through software rather than requiring major changes to the robot hardware. The current setup uses Arduino Uno R4 with built-in wifi and bluetooth. I was originally going to Raspis but was much harder to set up and modify.
I also agree that we should explore different ways of controlling or communicating with the robot. Voice and gesture/motion control are obvious possibilities, but I think it would be good not to commit ourselves too early to one particular method. A large, inviting physical start button might actually be a very effective interaction in an exhibition environment. We could potentially offer several ways of interacting and see which work best for different visitors. That also connects very nicely with the inclusive robotics work I have been doing.
The ability/range settings are also something I would like to explore further. DIP switches would give us a very quick and robust way of configuring different robots or behaviours. NFC is much more interesting in the longer term, though, particularly if we could use it to give individual robots different identities, abilities or characteristics. I rather like the idea that a Nic bot and a Gosia bot could effectively identify themselves to the system and behave differently  .... 🙂
Regarding the line-following questions:
Felt pen: Yes, this should work, provided there is sufficient contrast between the line and the background. The sensor is essentially distinguishing between light and dark areas rather than recognising a particular material. The line would need to be reasonably substantial - approximately 15 mm wide would be a sensible starting point (the width of the tape I use currently). A strong black felt-tip line on white paper or card should therefore be fine also.
Dry-wipe pen: Again, I would expect this to work on a white dry-wipe surface, provided that the black line is sufficiently dark and wide. This could actually be a very useful option because it would make routes extremely easy to modify and reset.
LED screen: I have never tried this, so I can’t say with any certainty. It is a really interesting possibility, though, and definitely worth experimenting with. The reflectance sensor relies on the amount of light reflected back from the surface, so an illuminated display is a rather different situation from a printed black line on a white surface. It may work, but we need to test it rather than assume that it will.
OLED screen: Similarly, I haven’t tested this. The fact that the black areas are genuinely non-illuminating might make this behave differently from some other display technologies, but again I would want to test it with the actual sensor. If either screen approach works reliably, it opens up some really interesting possibilities because the city routes could then change dynamically rather than being physically redrawn. That could lead to some interesting follow-up research projects.
Barcodes: The current barcode stripes are approximately 8-10 mm apart and of a similar sort of thickness, although these dimensions are not fixed and can be altered. The important limitation at present is that the barcodes need to be on straight sections of the route. They do not read reliably on bends because the robot and sensor cross the bars at different angles. We therefore need to allow a suitable straight section wherever we want the robot to encounter an encoded instruction or event. They are basically just binary numbers, so could be used to trigger practically anything.
Size of the city: I think we should regard approximately 1 square metre as the minimum useful area for the robot itself. The main restriction is the turning radius. If the curves are too tight, the robot can stray from the line or overshoot it. Larger, smoother curves are much more reliable.
For an exhibition, though, I suspect we may want to go somewhat larger than 1 m x 1 m. If we have a 2 x 4 metre overall space available, that sounds potentially very workable because we could use part of that for the actual city/robot environment and still have space for displays, interaction points and visitors. We could decide on the precise dimensions once we have a better idea of what the visitor journey looks like.
I would definitely be happy to try the different line approaches. I think a few simple experiments with paper/felt pen, dry-wipe board and whatever screens we can get hold of would answer quite a few questions very quickly. We could also experiment with different line widths, curve radii and barcode dimensions at the same time. That would give us some useful practical design constraints before we commit to how the city itself is constructed. One slight issue I have encountered is ambient light ... If ambient light is too bright, it can affect the reading of the track. To counter this, I have placed the reflectance sensor very close to the track itself (about 3mm above) which means that going up ramps could hit the sensor beneath.
I’m interested to see your different ideas for how the city might work. The combination of physical models, projected/digital elements and the robots themselves could be particularly effective, especially if the city visibly responds to what the robots and visitors do.
