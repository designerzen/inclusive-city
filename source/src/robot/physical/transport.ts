import { encodeControl, encodeFrames, FrameDecoder, parseIdentity, parseReport, ROBOT_SERVICE, ROBOT_IDENTITY, ROBOT_RX, ROBOT_TX } from './protocol';
import type { RobotCommand, RobotIdentity, RobotReport } from './protocol';
export interface RobotTransport {
  readonly identity: RobotIdentity;
  onReport: (report: RobotReport) => void;
  onDisconnect: (reason: string) => void;
  send(command: RobotCommand): Promise<void>;
  disconnect(): void;
}
interface Characteristic extends EventTarget {
  value?: DataView; readValue(): Promise<DataView>; startNotifications(): Promise<Characteristic>;
  writeValueWithResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
}
interface Device extends EventTarget {
  gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }> }>; disconnect(): void };
}
export function bluetoothAvailable() { return !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth; }
export class BleRobotTransport implements RobotTransport {
  onReport: RobotTransport['onReport'] = () => {};
  onDisconnect: RobotTransport['onDisconnect'] = () => {};
  private frameId = 0; private pumping = false;
  private normal: { frames: Uint8Array<ArrayBuffer>[]; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private urgent: typeof this.normal = [];
  private decoder = new FrameDecoder(); private closed = false;
  private constructor(readonly identity: RobotIdentity, private device: Device, private rx: Characteristic, private tx: Characteristic) {
    tx.addEventListener('characteristicvaluechanged', this.receive);
    device.addEventListener('gattserverdisconnected', this.lost);
  }
  static async connect() {
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice(options: unknown): Promise<Device> } }).bluetooth;
    if (!bluetooth) throw new Error('Use a browser with Web Bluetooth or connect through a gateway.');
    // Keep the chooser in the click's user activation, before any other await.
    const device = await bluetooth.requestDevice({ filters: [{ services: [ROBOT_SERVICE] }] });
    let transport: BleRobotTransport | undefined;
    try {
      if (!device.gatt) throw new Error('Robot has no BLE GATT server.');
      const server = await device.gatt.connect(), service = await server.getPrimaryService(ROBOT_SERVICE);
      const identityCharacteristic = await service.getCharacteristic(ROBOT_IDENTITY);
      const data = await identityCharacteristic.readValue();
      const identity = parseIdentity(JSON.parse(new TextDecoder().decode(data)));
      const rx = await service.getCharacteristic(ROBOT_RX), tx = await service.getCharacteristic(ROBOT_TX);
      transport = new BleRobotTransport(identity, device, rx, tx);
      await tx.startNotifications(); return transport;
    } catch (error) { transport?.disconnect(); device.gatt?.disconnect(); throw error; }
  }
  private receive = () => {
    try { if (this.tx.value) { const value = this.decoder.accept(this.tx.value); if (value !== undefined) this.onReport(parseReport(value)); } }
    catch (error) { this.onDisconnect(String(error)); this.disconnect(); }
  };
  private lost = () => { if (!this.closed) { this.closed = true; this.onDisconnect('Bluetooth disconnected.'); } };
  send(command: RobotCommand) {
    const control = ['heartbeat', 'stop', 'hold'].includes(command.type);
    const frames = control ? [encodeControl(command)] : encodeFrames(command, ++this.frameId);
    return new Promise<void>((resolve, reject) => {
      (control ? this.urgent : this.normal).push({ frames, resolve, reject });
      void this.pump();
    });
  }
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.normal.length || this.urgent.length) {
        const queue = this.urgent.length ? this.urgent : this.normal, item = queue[0]!;
        try {
          if (this.closed || !this.device.gatt?.connected) throw new Error('Robot disconnected.');
          await this.rx.writeValueWithResponse(item.frames.shift()!);
          if (!item.frames.length) { queue.shift(); item.resolve(); }
        } catch (error) {
          for (const pending of [...this.normal, ...this.urgent]) pending.reject(error);
          this.normal = []; this.urgent = []; this.onDisconnect(String(error)); this.disconnect(); break;
        }
      }
    } finally { this.pumping = false; }
  }
  disconnect() {
    this.closed = true; this.tx.removeEventListener('characteristicvaluechanged', this.receive);
    this.device.removeEventListener('gattserverdisconnected', this.lost); this.device.gatt?.disconnect();
  }
}

// The gateway exposes one WebSocket per hardware ID; it routes commands to BLE.
export class GatewayRobotTransport implements RobotTransport {
  onReport: RobotTransport['onReport'] = () => {};
  onDisconnect: RobotTransport['onDisconnect'] = () => {};
  private constructor(readonly identity: RobotIdentity, private socket: WebSocket) {
    socket.onmessage = event => {
      try { if (typeof event.data !== 'string' || event.data.length > 32768) throw new Error('Invalid gateway message.'); this.onReport(parseReport(JSON.parse(event.data))); }
      catch (error) { this.onDisconnect(String(error)); this.disconnect(); }
    };
    socket.onclose = () => this.onDisconnect('Gateway disconnected.');
    socket.onerror = () => this.onDisconnect('Gateway connection failed.');
  }
  static connect(address: string): Promise<GatewayRobotTransport> {
    const url = new URL(address);
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use wss:// or a localhost ws:// gateway.');
    if (url.username || url.password) throw new Error('Do not put credentials in the gateway URL.');
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => { socket.close(); reject(new Error('Gateway identity timed out.')); }, 5000);
      const fail = () => { clearTimeout(timer); socket.close(); reject(new Error('Gateway connection failed.')); };
      socket.onerror = fail; socket.onclose = fail;
      socket.onmessage = event => {
        try {
          if (typeof event.data !== 'string' || event.data.length > 4096) throw new Error('Invalid gateway identity.');
          const identity = parseIdentity(JSON.parse(event.data)); clearTimeout(timer); resolve(new GatewayRobotTransport(identity, socket));
        } catch (error) { clearTimeout(timer); socket.close(); reject(error); }
      };
    });
  }
  async send(command: RobotCommand) {
    if (this.socket.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 32768) throw new Error('Gateway unavailable or congested.');
    this.socket.send(JSON.stringify(command));
  }
  disconnect() { this.socket.onclose = null; this.socket.onerror = null; this.socket.close(); }
}
