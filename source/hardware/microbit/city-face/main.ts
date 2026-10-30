// MakeCode micro:bit firmware. No radio or motor driver is required.
// Each LF-terminated UART frame fits in a single 20-byte BLE packet.
let connected = false
let lastFrame = 0
let face = ""
let outgoing: string[] = []
let speechVersion = 0
let speaking = false
let nextSpeech = ""
let receiving = ""
let textBuffer = ""
let nextChunk = 0
let soundEnabled = true
let cueVersion = 0
let nextCue = ""
let moving = false
let playingMove = false
let nextMoveAt = 0
let movePhrase = 0
const hexDigits = "0123456789ABCDEF"
const codes = "RMBPWHITFE"
// 5x5 emoji faces: ready, curious, sad, paused, waiting, happy, idle,
// tired, frustrated and celebrating.
const faces = [
    "0000001010000001000101110",
    "0101001010000001000101110",
    "0101000000000000111010001",
    "0101001010000000000001110",
    "0101000000000000010000000",
    "1000101010000001000101110",
    "0000001010000000000001110",
    "0000011011000000111000000",
    "1000101010000001111110001",
    "1010101010000001000101110"
]
function draw(pattern: string) {
    basic.clearScreen()
    for (let i = 0; i < 25; i++) {
        if (pattern.charAt(i) == "1") led.plot(i % 5, Math.idiv(i, 5))
    }
}
function pairing() {
    // Bluetooth rune: powered and ready for the city's Pair micro:bit face button.
    draw("0010000110101010011000100")
}
function showFace(openMouth: boolean) {
    const index = codes.indexOf(face)
    if (index < 0) { pairing(); return }
    const pattern = faces[index]
    draw(openMouth ? pattern.substr(0, 15) + "0111001110" : pattern)
}
function stopNotes() {
    cueVersion++
    nextCue = ""
    music.stopAllSounds()
}
function playCue(code: string) {
    stopNotes()
    if (soundEnabled && code != "I" && code != "") nextCue = code
}
function stopSpeech() {
    stopNotes()
    speechVersion++
    speaking = false
    nextSpeech = ""
    receiving = ""
    textBuffer = ""
    nextChunk = 0
    led.stopAnimation()
}
function hexNumber(value: string) {
    let number = 0
    for (let i = 0; i < value.length; i++) {
        const digit = hexDigits.indexOf(value.charAt(i))
        if (digit < 0) return -1
        number = number * 16 + digit
    }
    return number
}
function queue(frame: string) {
    if (connected && outgoing.length < 8) outgoing.push(frame + "\n")
}
bluetooth.onBluetoothConnected(function () {
    stopSpeech()
    connected = true
    moving = false
    face = ""
    lastFrame = input.runningTime()
    outgoing = []
    pairing()
})
bluetooth.onBluetoothDisconnected(function () {
    stopSpeech()
    connected = false
    moving = false
    outgoing = []
    face = ""
    pairing()
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    const frame = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (frame == "HELLO") {
        queue("CITYFACE:3")
    } else if (frame == "RUN:0" || frame == "RUN:1") {
        moving = frame == "RUN:1" && face != "" && face != "I"
        lastFrame = input.runningTime()
        if (!moving && playingMove) {
            cueVersion++
            music.stopAllSounds()
        }
        queue(frame)
    } else if (frame.length == 6 && frame.substr(0, 5) == "FACE:") {
        const code = frame.charAt(5)
        const index = codes.indexOf(code)
        if (index >= 0) {
            lastFrame = input.runningTime()
            if (face != code) {
                face = code
                if (code == "I") { moving = false; stopSpeech() }
                else playCue(code)
                if (!speaking) showFace(false)
            }
            queue("ACK:" + code)
        } else queue("ERR:FRAME")
    } else if (frame == "STOP") {
        lastFrame = input.runningTime()
        stopSpeech()
        showFace(false)
        queue("STOP")
    } else if (frame.length == 8 && frame.substr(0, 4) == "SAY:" && hexNumber(frame.substr(4, 4)) >= 0) {
        stopSpeech()
        receiving = frame.substr(4, 4)
        lastFrame = input.runningTime()
        showFace(false)
        queue(frame)
    } else if (frame.length >= 13 && frame.length <= 19 && frame.substr(0, 4) == "TXT:"
        && receiving != "" && frame.substr(4, 4) == receiving && frame.charAt(8) == ":" && frame.charAt(11) == ":"
        && hexNumber(frame.substr(9, 2)) == nextChunk && textBuffer.length + frame.length - 12 <= 240) {
        const chunk = frame.substr(12)
        for (let i = 0; i < chunk.length; i++) {
            if (chunk.charCodeAt(i) < 32 || chunk.charCodeAt(i) > 126) { queue("ERR:FRAME"); return }
        }
        textBuffer += chunk
        nextChunk++
        lastFrame = input.runningTime()
        queue(frame.substr(0, 11))
    } else if (frame.length == 8 && frame.substr(0, 4) == "END:" && receiving != "" && frame.substr(4, 4) == receiving && textBuffer.length > 0) {
        nextSpeech = textBuffer
        playCue("V")
        receiving = ""
        textBuffer = ""
        lastFrame = input.runningTime()
        queue(frame)
    } else queue("ERR:FRAME")
})
// Portable music APIs drive the V2 built-in speaker automatically. On V1,
// sounds are only audible if an external speaker is attached to P0/GND.
// Avoid V2-only speaker-enable calls, which would panic on a V1 board.
music.setVolume(64)
input.onButtonPressed(Button.A, function () {
    if (connected && face != "" && face != "I" && input.runningTime() - lastFrame <= 5000) queue("BTN:A")
})
input.onButtonPressed(Button.B, function () {
    if (connected && face != "" && face != "I" && input.runningTime() - lastFrame <= 5000) queue("BTN:B")
})
input.onButtonPressed(Button.AB, function () {
    soundEnabled = !soundEnabled
    stopNotes()
    if (soundEnabled && connected) playCue(face)
})
bluetooth.startUartService()
pairing()
basic.forever(function () {
    if (connected && outgoing.length > 0) bluetooth.uartWriteString(outgoing.shift())
    // If the page stops updating, stop showing a stale journey expression.
    if (connected && face != "" && input.runningTime() - lastFrame > 5000) {
        stopSpeech()
        moving = false
        face = ""
        pairing()
    }
    basic.pause(20)
})
// One independent audio fiber: short finite phrases never delay BLE or LEDs.
basic.forever(function () {
    if (connected && soundEnabled && moving && !speaking && nextSpeech == "" && receiving == ""
        && nextCue == "" && input.runningTime() >= nextMoveAt) {
        nextCue = "D"
        nextMoveAt = input.runningTime() + 2400
    }
    if (connected && soundEnabled && nextCue != "") {
        const code = nextCue
        const version = cueVersion
        playingMove = code == "D"
        nextCue = ""
        let notes = [523, 659]
        if (code == "B") notes = [392, 330, 262]
        else if (code == "F") notes = [220, 0, 220]
        else if (code == "T") notes = [330, 294, 262]
        else if (code == "W" || code == "P") notes = [440, 0, 440]
        else if (code == "H") notes = [523, 659, 784]
        else if (code == "E") notes = [523, 659, 784, 1047]
        else if (code == "V") notes = [523, 659, 587]
        else if (code == "D") {
            if (movePhrase % 3 == 0) notes = [523, 659, 784, 659]
            else if (movePhrase % 3 == 1) notes = [784, 0, 988, 784]
            else notes = [659, 587, 523, 784]
            movePhrase++
        }
        for (let i = 0; i < notes.length; i++) {
            if (!connected || !soundEnabled || version != cueVersion || playingMove && !moving) break
            music.playTone(notes[i], 70)
        }
        playingMove = false
    }
    basic.pause(20)
})
// Display work yields independently of UART/heartbeat processing. New messages,
// leaving the city and disconnects can interrupt even a long text scroll.
basic.forever(function () {
    if (connected && nextSpeech != "") {
        const message = nextSpeech
        const version = speechVersion
        nextSpeech = ""
        speaking = true
        for (let pulse = 0; pulse < 6; pulse++) {
            if (!connected || version != speechVersion) break
            showFace(pulse % 2 == 0)
            basic.pause(120)
        }
        if (connected && version == speechVersion) basic.showString(message, 70)
        if (version == speechVersion) { speaking = false; showFace(false) }
    }
    basic.pause(20)
})
