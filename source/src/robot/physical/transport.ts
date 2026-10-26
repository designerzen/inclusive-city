export interface BleSettings {
  service: string; write: string; notify: string; namePrefix?: string;
  writeMode?: 'auto' | 'with-response' | 'without-response'; chunkSize?: number; swapUart?: boolean;
}
export const nordicUart: BleSettings = {
  service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
};
export const microbitUart: BleSettings = { service: nordicUart.service, write: nordicUart.notify, notify: nordicUart.write, namePrefix: 'BBC micro:bit', swapUart: true };
export function validateBleSettings(s: BleSettings) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const normalise = (value: string) => {
    if (typeof value !== 'string') throw new Error('Enter service/write UUIDs and an optional notification UUID.');
    const trimmed = value.trim().toLowerCase();
    return /^[a-f0-9]{4}$|^[a-f0-9]{8}$/.test(trimmed) ? `${trimmed.padStart(8, '0')}-0000-1000-8000-00805f9b34fb` : trimmed;
  };
  const service = normalise(s.service), write = normalise(s.write), notify = normalise(s.notify);
  if (!uuid.test(service) || !uuid.test(write) || notify && !uuid.test(notify)) throw new Error('Enter valid service/write UUIDs and an optional notification UUID.');
  if (s.writeMode !== undefined && !['auto', 'with-response', 'without-response'].includes(s.writeMode)) throw new Error('Choose a valid Bluetooth write mode.');
  if (s.chunkSize !== undefined && (!Number.isInteger(s.chunkSize) || s.chunkSize < 1 || s.chunkSize > 512)) throw new Error('Packet size must be between 1 and 512 bytes.');
  if (s.namePrefix !== undefined && (typeof s.namePrefix !== 'string' || s.namePrefix.length > 248)) throw new Error('Bluetooth name prefix is too long.');
  return { ...s, service, write, notify };
}
export interface RobotTransport {
  readonly id: string; readonly name: string;
  onData: (data: Uint8Array) => void; onDisconnect: (reason: string) => void;
  send(data: Uint8Array, urgent?: boolean): Promise<void>; disconnect(): void;
}
/** Independent bounded queues; Stop cancels unsent commands and goes next. */
export class RobotWriteQueue {
  private items: { data: Uint8Array; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private pumping = false; private closed = false;
  constructor(private write: (data: Uint8Array) => Promise<void>) {}
  send(data: Uint8Array, urgent = false) {
    if (this.closed) return Promise.reject(new Error('Robot disconnected.'));
    if (!data.length || data.length > 4096 || !urgent && this.items.length >= 16) return Promise.reject(new Error('Empty/oversized command or full robot queue.'));
    return new Promise<void>((resolve, reject) => {
      const item = { data: data.slice(), resolve, reject };
      if (urgent) { for (const old of this.items) old.reject(new Error('Cancelled by Stop.')); this.items = [item]; }
      else this.items.push(item);
      void this.pump();
    });
  }
  private async pump() {
    if (this.pumping) return; this.pumping = true;
    try { while (this.items.length && !this.closed) {
      const item = this.items.shift()!;
      try { await this.write(item.data); item.resolve(); }
      catch (error) { item.reject(error); this.close(error); }
    } } finally { this.pumping = false; }
  }
  close(error: unknown = new Error('Robot disconnected.')) { this.closed = true; for (const item of this.items) item.reject(error); this.items = []; }
}
interface Characteristic extends EventTarget {
  value?: DataView; properties: { write: boolean; writeWithoutResponse: boolean };
  startNotifications(): Promise<Characteristic>;
  writeValueWithResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
}
interface Device extends EventTarget {
  id: string; name?: string;
  gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }> }>; disconnect(): void };
}
export function bluetoothAvailable() { return !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth; }
export function withTimeout<T>(operation: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Robot operation timed out.')), ms);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export class BleRobotTransport implements RobotTransport {
  readonly id: string; readonly name: string;
  onData: RobotTransport['onData'] = () => {}; onDisconnect: RobotTransport['onDisconnect'] = () => {};
  private queue: RobotWriteQueue; private closed = false;
  private constructor(private device: Device, write: Characteristic, private notify: Characteristic | undefined, settings: BleSettings) {
    this.id = device.id; this.name = device.name || 'Bluetooth robot';
    this.queue = new RobotWriteQueue(async data => {
      if (this.closed || !device.gatt?.connected) throw new Error('Bluetooth disconnected.');
      const size = settings.chunkSize ?? 20;
      for (let offset = 0; offset < data.length; offset += size) {
        if (this.closed) throw new Error('Bluetooth disconnected.');
        const chunk = new Uint8Array(data.subarray(offset, offset + size));
        const response = settings.writeMode === 'with-response' || settings.writeMode !== 'without-response' && write.properties.write;
        await withTimeout(response ? write.writeValueWithResponse(chunk) : write.writeValueWithoutResponse(chunk), 5000);
      }
    });
    notify?.addEventListener('characteristicvaluechanged', this.receive); device.addEventListener('gattserverdisconnected', this.lost);
  }
  static async connect(input: BleSettings, connectedIds: ReadonlySet<string> = new Set()) {
    const s = validateBleSettings(input);
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice(options: unknown): Promise<Device> } }).bluetooth;
    if (!bluetooth) throw new Error('Use a browser with Web Bluetooth or an existing gateway.');
    const device = await bluetooth.requestDevice(s.namePrefix
      ? { filters: [{ namePrefix: s.namePrefix }], optionalServices: [s.service] }
      : { filters: [{ services: [s.service] }] });
    if (connectedIds.has(device.id)) throw new Error('This robot is already connected.');
    return BleRobotTransport.open(device, s);
  }
  /** Reuse the granted device when switching profiles; no motor command is replayed. */
  reconnect(input: BleSettings) {
    const settings = validateBleSettings(input);
    this.disconnect();
    return BleRobotTransport.open(this.device, settings);
  }
  private static async open(device: Device, s: BleSettings) {
    let transport: BleRobotTransport | undefined;
    try {
      if (!device.gatt) throw new Error('Robot has no BLE GATT server.');
      const server = await withTimeout(device.gatt.connect(), 10000), service = await server.getPrimaryService(s.service);
      let write = await service.getCharacteristic(s.write);
      let notify = s.notify ? await service.getCharacteristic(s.notify) : undefined;
      // micro:bit runtimes have shipped both UART characteristic assignments.
      if (s.swapUart && !write.properties.write && !write.properties.writeWithoutResponse && notify && (notify.properties.write || notify.properties.writeWithoutResponse)) [write, notify] = [notify, write];
      if (!write.properties.write && !write.properties.writeWithoutResponse) throw new Error('Characteristic cannot accept commands.');
      if (s.writeMode === 'with-response' && !write.properties.write || s.writeMode === 'without-response' && !write.properties.writeWithoutResponse) throw new Error('The selected Bluetooth write mode is not supported by this firmware.');
      transport = new BleRobotTransport(device, write, notify, s); if (notify) await withTimeout(notify.startNotifications(), 10000); return transport;
    } catch (error) { transport?.disconnect(); device.gatt?.disconnect(); throw error; }
  }
  private receive = () => { const v = this.notify?.value; if (v) this.onData(new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice()); };
  private lost = () => { if (!this.closed) { this.queue.close(); this.onDisconnect('Bluetooth disconnected.'); this.disconnect(); } };
  async send(data: Uint8Array, urgent = false) {
    try { await this.queue.send(data, urgent); }
    catch (error) { if (!this.closed && !(error instanceof Error && error.message === 'Cancelled by Stop.')) { this.onDisconnect(String(error)); this.disconnect(); } throw error; }
  }
  disconnect() { if (this.closed) return; this.closed = true; this.queue.close(); this.notify?.removeEventListener('characteristicvaluechanged', this.receive); this.device.removeEventListener('gattserverdisconnected', this.lost); this.device.gatt?.disconnect(); }
}
/** Optional adapter for an existing gateway: plain text in, sensor text out. */
export class GatewayRobotTransport implements RobotTransport {
  onData: RobotTransport['onData'] = () => {}; onDisconnect: RobotTransport['onDisconnect'] = () => {};
  readonly name = 'Gateway robot';
  private constructor(readonly id: string, private socket: WebSocket) {
    socket.onmessage = event => {
      if (typeof event.data === 'string' && event.data.length <= 16384) this.onData(new TextEncoder().encode(event.data));
      else if (event.data instanceof ArrayBuffer && event.data.byteLength <= 16384) this.onData(new Uint8Array(event.data));
      else { this.onDisconnect('Invalid gateway message.'); this.disconnect(); }
    };
    socket.onclose = () => this.onDisconnect('Gateway disconnected.'); socket.onerror = () => this.onDisconnect('Gateway connection failed.');
  }
  static async connect(address: string) {
    const url = new URL(address); url.hash = '';
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use wss:// or a localhost ws:// gateway.');
    if (url.username || url.password) throw new Error('Do not put credentials in the URL.');
    const socket = new WebSocket(url); socket.binaryType = 'arraybuffer';
    try { await withTimeout(new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve(); socket.onerror = () => reject(new Error('Gateway connection failed.')); socket.onclose = () => reject(new Error('Gateway closed.'));
    }), 5000); return new GatewayRobotTransport(url.href, socket); }
    catch (error) { socket.close(); throw error; }
  }
  async send(data: Uint8Array) {
    if (this.socket.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 16384) throw new Error('Gateway unavailable or congested.');
    this.socket.send(new TextDecoder().decode(data));
  }
  disconnect() { this.socket.onclose = null; this.socket.onerror = null; this.socket.close(); }
}
