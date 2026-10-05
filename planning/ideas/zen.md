Weaving the narrative by story telling... 
Your role is to help the Artbots make art!

In summary :

1. Greet your robot and choose a name and a robot shell (this could be a simple cardboard net or a custom plastic form). Each robot shell has a set of unique attributes TBD but can include speed, forgetfulness, low vision, balance, confusion etc.
These shells could themselves be used as physical restrictions due to their shape (eg. too tall, too fat, too short). Guests are encouraged to jazz their robots up and make memorable styles whilst we communicate some potential issues that they may encounter when in the robot city. It is important to explain that it is an artbot who loves to make art with humans and that they want to make art with you!

2. The shell is placed onto the rixbot and inherits its behaviour. The robot starts its journey following the line under it. The city then becomes the "program" for the robot and the game is to modify the city to give your artbot the best chances to succeed at its goal - which is making art. There may be some hazards in the city as well as opportunities.
Rixbot will have new multicolour LED lights and a speaker inside that communicates its personality and any issues it encounters. Depending on how this is set up, the city could be as simple as drawing lines onto a large piece of paper (even the user can draw it), or as complex as placing 3d printed tiles with preset routes and instructions. The bot behaviour is very basic AI similar to the ghosts in pacman, where each has custom behaviour that affects how it travels around the maze, but from simple rules does complexity arise
https://pacman30thanniversary.net/pacman-ghost-movement-pattern/

3. As the rixbots move around the city, they activate and "pick up" things for art which is communicated to a central machine (bluetooth) that collects all this robot art data and presents it in realtime. This can be presented both as audio and visually. An example could be that the drumbot picks up drum sounds as it wanders around the city and the barcodelines then trigger certain beats in sequence - this sequence then forms the backing track. Each artwork would be unique and we can offer it to take home (even print them out!). Perhaps the robot type decides what type of art the bot wants to create? You also get to complete the artwork yourself so your robot duet becomes personal! 


Rixbot is already set up to handle much of what we want! We shouldn't need to change out parts at the event - instead disable functionality depending on the parameters set from the shell. This then simplifies presentation and reduces complexity. We don't have much time but I think this is achievable and is a worthwhile development for the Rixbot! DIP Switches were suggested which is a good pace to start...

With NFC, it would be possible to set the functionality of the rixbot by tapping on its top with your personal ID card or Oyster card, or even mobile phone, which is a very powerful concept in itself - customised robot personalities. As NFC requires touch, it is not that useful to have under the robot due to the clearance, but there is the option to add functionality to the city using RFID chips too if the NFC reader is cunningly positioned below. I considered adding to the cardboard net, tongues that fit into straps on a custom printed rixbot body where one of these tongues reaches under the bot to provide the RFID chip in the correct position.

I suspect a custom printed body for the Rixbot would be very useful for us to form as the base for these shells. One of the main inspirations, Big Loader, is a super awesome toy (https://www.youtube.com/watch?v=tgnbEFuSlXY) which we are stealing some of the magic from - their shells are incredible and are very illustrative - we should learn from this. It would be good to add elements that allow for the skin to mount rather than sit as a hat.

fun stuff / potential tech :

- NFC with RFID stickers on cardboard nets would work fine, these kinds of things :
chip : https://uk.robotshop.com/products/waveshare-pn532-nfc-hat-for-raspberry-pi-i2c-spi-uart
stickers : https://www.idcardsdirect.co.uk/id-cards/rfid-labels-stickers.html
These would be stuck inside the shell somewhere that makes contact via gravity on the rixbot or via a tongue / groove that is more involving but more reliable. This communicates abilities.

-  Rixbot already has a bluetooth interface so it can communicate to a computer as it travels around the city, reading the extra data from the barcoded lines, as well as sending out any sensor data it encounters. A simple enhancement at this stage would be to hide a bluetooth speaker inside, paired to this computer, which allows us to then use the data from the rixbot in realtime to send audio that can be heard coming from the robot. This would allow us to give the robots personality. Also, by offsetting this from the microcontroller, I can make very complex things relatively simply and avoid the limitations of the PIC.

- There could be a zone in the city that has a camera for the robot to do a fashion catwalk and we can stream this video!

- Abilities could be dichotomous : more speed -> less memory like in real life. Do you want a zen's mum or a zen's aunty robot type?

- If we use RFID, Kate could have a secret tablet with software that allows her to control all the attributes for any robot which would allow her to tailor robots to individuals beyond the 5 presets!

- Another amazing RFID quirk (if we have time) is to reprogram the chip whilst it is in the city, so that once the robot leaves the city, their journey is encoded in the shell. This could be re-read later as the basis for the art or even used as the basis for more art, remixed with the user. As the shell has the RFID built in, and the user takes them home, the artwork would forever be encoded into the robot skin and would give the robot MEMORY!

- Regarding abilities, this is more for a future project, but it is entirely possible to add RFID chips inside googly eyes which could be used to grant more literal abilities to the robot!

- QR codes let you send data from a distance and very fast. I used the following chip in the milton keynes museum (see photo) for their coin installation which lets you rotate (at speed!) a giant wheel full of old coins. I needed the wheel to inform the computer which coin was selected and the only way that I could communicate over an airgap with no latency was using this. By removing the need for contacts, I am confident it will work reliably for generations! 
https://www.adafruit.com/product/5744
This could be used in addition to the line following chip under the robot to communicate more data from the environment if required (current floor strategy with barcodes only communicate a few bytes).
We could have stickers made up with the different pickups / powers / functionality and allow those to be stuck in the city!

- If we are smart about how we position part 3, we could also use this to entertain the queue by "duetting" with the robots and draw more crowds in.

- Public is asked to name the robot but we can have surnames with some sense of scientific / artistic connections... Pablobot, Moonbot (IdrisBot?), DerbyshireBot etc

Reasons this is strong concept : 

- Makes the abstract concept of accessibility very accessible :) 
- Illustrates the social model of disability 
- It is FUN. fun fun fun fun fun.

Email with nic:

I love the rixbot and your blog posts were the main inspiration for this idea, in particular your recent post about encoding data into the environment and using the bot as a trigger for audio and other functionality. This seemed the perfect opportunity to build that into the rixbot and we can work together to not only implement the functionality that you suggest, but by sending the bluetooth signals back to a central server - a dedicated machine that expects and manages these signals (from multiple bots even) then the bot can be responsible for the story telling itself and we can use onscreen directions, videos and audio (that we pipe back into the robot body). In this way the robot can communicate its woes and accidents back to this server which handles game state and communications to the public - allowing the simple rixbot to have an elaborate character, personality, even conversations with the public. The current controls sent for stop and go could then be augmented using whichever technology we feel works best - you mentioned voice control or motion control - both of these are possible with this approach. It might be as simple as an inviting start button for them to press.

I think this two way data comms is critical for the concept but my understanding is that there is already a bluetooth radio that pairs to the controller, so I am hoping it is only a software update (happy to help).

I know that this takes some of the brain out of the robot, but by having a shared brain with more connections and power, we can make the robot far more capable and manage the world around through their actions.

In terms of the other stuff we mentioned, I think ability toggling / setting ranges is a big part but a lovely concept and would love to discuss this further. DIP switches would definitely help us put something together quickly, NFC would be the dream as it is so quick and handy (and somewhat charming that we can have a nic and a gosia bot).

Questions I wanted to ask yesterday :

The line reading :

* Can the robot follow a line that is drawn in felt pen?
* Can the robot follow the line if it is drawn in dry wipe pen?
* Can the robot follow a line drawn on an LED screen (ie if there is a onscreen map)?
* Can the robot follow a line drawn on an OLED screen (ie. a screen with non-illuminating black)?
* What are the dimensions for the barcodes, how much space will be needed?
* How large would this city need to be?

Is there any chance we can give these a try? We have different approaches for how to make this city, from table screens, to overhead projectors and dry wipes, to 3d prints and models... Ideally we want something very easy to operate and quick to reset! 

People are usually given 2 x 4 metre space but if we need more I can sweet talk the RS for sure but we would have to specify how much space we need. They are very accommodating and the building is giant.

I will spend some time over the next few days putting together various illustrative speculations as to how this city can be approached and how the game side can be worked on independently. Stay tuned.
