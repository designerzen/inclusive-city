import type { PlannedJourney } from '../../simulation/plannedJourney';
import type { routeProjection } from '../../city/routeProjection';
import type { SensorReport } from './session';
/** Local game adapter only: it sends no route or protocol setup to the robot. */
export class PhysicalJourney {
  private origin?: number; private lastDistance = 0; private lastTime = 0; private nextMarker = 0;
  private confirmed = new Set<number>(); private pickups = new Set<number>(); private lastMarkerTime = -Infinity;
  active = true;
  private status: 'following' | 'held' | 'stopped' | 'fault' = 'stopped';
  constructor(readonly journey: PlannedJourney, readonly mmPerUnit: number,
    readonly markers: ReturnType<typeof routeProjection>['markers'], initialDistance?: number) {
    if (!Number.isFinite(mmPerUnit) || mmPerUnit <= 0 || mmPerUnit > 10000) throw new Error('Enter measured millimetres per city unit.');
    this.origin = initialDistance; journey.reservePhysical();
  }
  observe(report: SensorReport, time: number) {
    if (!this.active || this.journey.complete) return;
    let distance = this.lastDistance;
    if (report.distanceMm !== undefined) {
      this.origin ??= report.distanceMm;
      distance = (report.distanceMm - this.origin) / this.mmPerUnit;
      if (distance < this.lastDistance - .01 || distance > this.journey.trajectory.length + 1) throw new Error('Distance is inconsistent with the bound city route. Rebind after reset.');
    }
    if (report.event === 'marker') {
      const marker = this.markers[this.nextMarker];
      if (report.markerIndex !== undefined && report.markerIndex < this.nextMarker && this.confirmed.has(report.markerIndex)) return;
      if (report.markerIndex === undefined && report.code === this.markers[this.nextMarker - 1]?.code && time - this.lastMarkerTime < 1000) return;
      if (!marker || report.code !== marker.code || report.markerIndex !== undefined && report.markerIndex !== this.nextMarker)
        throw new Error('Unexpected barcode; check the route and robot position.');
      this.confirmed.add(this.nextMarker++); this.lastMarkerTime = time;
      distance = Math.max(distance, marker.endDistance);
      if (report.distanceMm !== undefined) this.origin = report.distanceMm - distance * this.mmPerUnit;
    }
    if (this.journey.ready && (report.status === 'following' || distance > 0 || report.event === 'marker')) this.journey.beginPhysical();
    const seconds = this.lastTime ? Math.max(0, Math.min(5, (time - this.lastTime) / 1000)) : 0;
    const previousDistance = this.lastDistance;
    this.lastTime = time; this.lastDistance = Math.max(this.lastDistance, distance);
    if (report.status !== undefined) this.status = report.status === 'ready' ? 'stopped' : report.status;
    else if (this.status !== 'held' && this.status !== 'fault' && (distance > previousDistance || report.event === 'marker')) this.status = 'following';
    this.journey.observePhysical(this.lastDistance, this.status === 'following' ? (report.speedMmS ?? 0) / this.mmPerUnit : 0, seconds, this.status);
    for (const index of this.confirmed) {
      const marker = this.markers[index]!;
      if (!this.pickups.has(index) && this.lastDistance >= marker.milestone && marker.eventCode >= 8 && marker.eventCode <= 11) {
        this.pickups.add(index); this.journey.physicalPickup(marker.nodeId);
      }
    }
    if (report.event === 'arrived') {
      if (this.nextMarker !== this.markers.length || report.status !== 'stopped') throw new Error('Arrival needs the route markers and a stopped report.');
      this.journey.finishPhysical();
    }
  }
  freeze() { this.active = false; this.journey.observePhysical(this.lastDistance, 0, 0, 'stopped'); }
  activate() { this.active = true; this.lastTime = 0; }
}
