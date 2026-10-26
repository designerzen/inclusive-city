// MakeCode TypeScript for micro:bit V2. Add the bluetooth extension; remove radio.
// Project Settings > Bluetooth > No Pairing Required (test devices only).
// Protocol: uppercase ASCII frames terminated with LF, each under 20 bytes.
let connected = false
let automatic = false
let selected = 0
let lastAutomatic = 0
let outgoing: string[] = []
const codes = "0123456789ABCDEF"
// Keep these labels in sync with source/src/robot/commsProtocol.ts.
const messages = ["Ready", "Start", "Stop", "Pause", "Resume", "Forward", "Reverse", "Left", "Right", "Arrived", "Obstacle", "Clear", "Help", "Busy", "Happy", "Goodbye"]

function showMessage(code: number) {
    basic.clearScreen()
    for (let x = 0; x < 5; x++) {
        led.plot(x, 0)
        led.plot(x, 2)
    }
    for (let bit = 0; bit < 4; bit++) {
        if ((code & (8 >> bit)) != 0) led.plot(bit, 4)
    }
}
function queueFrame(frame: string) {
    // One sender fiber avoids interleaving button, timer and ACK UART frames.
    if (connected && outgoing.length < 16) outgoing.push(frame + "\n")
}
function sendSelected() {
    showMessage(selected)
    queueFrame("SIG:" + codes.charAt(selected))
}
bluetooth.onBluetoothConnected(function () {
    outgoing = []
    automatic = false
    connected = true
    showMessage(selected)
})
bluetooth.onBluetoothDisconnected(function () {
    connected = false
    automatic = false
    outgoing = []
    basic.showIcon(IconNames.No)
})
input.onButtonPressed(Button.A, function () {
    selected = (selected + 1) % messages.length
    showMessage(selected)
})
input.onButtonPressed(Button.B, function () {
    sendSelected()
})
input.onButtonPressed(Button.AB, function () {
    if (connected) {
        automatic = !automatic
        lastAutomatic = input.runningTime()
        queueFrame(automatic ? "AUTO:1" : "AUTO:0")
    }
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    const frame = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (frame.length == 5 && frame.substr(0, 4) == "CMD:") {
        const code = codes.indexOf(frame.charAt(4))
        if (code >= 0) {
            selected = code
            showMessage(selected)
            queueFrame("ACK:" + codes.charAt(code))
            return
        }
    } else if (frame == "AUTO:0" || frame == "AUTO:1") {
        automatic = frame == "AUTO:1"
        lastAutomatic = input.runningTime()
        queueFrame(frame)
        return
    }
    queueFrame("ERR:FRAME")
})
bluetooth.startUartService()
showMessage(selected)
basic.forever(function () {
    if (connected && outgoing.length > 0) bluetooth.uartWriteString(outgoing.shift())
    basic.pause(20)
})
basic.forever(function () {
    if (connected && automatic && input.runningTime() - lastAutomatic >= 8000) {
        lastAutomatic = input.runningTime()
        selected = randint(0, 15)
        sendSelected()
    }
    basic.pause(100)
})
