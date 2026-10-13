import '../../src/styles.css';
import '../../src/lightTheme.css';
import '../../src/cityHud.css';
import '../../src/uiDesign.css';
import '../../src/accessibility.css';
import '../../src/cityCompactHud.css';
import { mountPhysicalRobots } from '../../src/ui/physicalRobots';
import { BleRobotTransport } from '../../src/robot/physical/transport';
import type { RobotTransport } from '../../src/robot/physical/transport';
const style = document.createElement('style');
style.textContent = '#city-screen{position:static;display:block;min-height:100vh;height:auto;overflow:visible;padding:12px}#city-screen .city-plan{max-height:none;overflow:visible;max-width:600px;margin:auto}body{overflow:auto}'; document.head.append(style);
Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {} });
let next = 0;
class MockRobot implements RobotTransport {
  id = `test-${++next}`; name = `BBC micro:bit [test ${next}]`;
  onData = (_: Uint8Array) => {}; onDisconnect = (_: string) => {};
  async send(data: Uint8Array) {
    const command = new TextDecoder().decode(data).trim();
    const status = command === 'STOP' ? 'stopped' : command === 'PAUSE' ? 'held' : 'following';
    this.onData(new TextEncoder().encode(`battery:75\nstatus:${status}\n`));
  }
  disconnect() {}
}
BleRobotTransport.connect = async () => new MockRobot() as unknown as BleRobotTransport;
const projection = { openPhysical() { throw new Error('Route tracking is tested separately.'); }, lockPhysicalViewport() {}, physicalHealthy: () => true, closePhysical() {}, refresh() {}, close() {}, dispose() {} };
const control = mountPhysicalRobots(document.querySelector('#fixture')!, () => undefined, projection, () => {}); control.open();
