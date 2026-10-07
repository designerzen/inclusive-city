import { isHumpbackBridge } from '../city/humpbackBridge';
import type { PlannedJourney } from '../simulation/plannedJourney';
import { robotFootprint, robotButtonReach } from '../city/proceduralCity';

export type CityReplyAction =
  | { kind: 'repair'; id: string }
  | { kind: 'feature'; id: string }
  | { kind: 'dimension'; id: string; value: number }
  | { kind: 'bridge-access'; id: string; access: 'ramp' | 'elevator' }
  | { kind: 'ask-robot' }
  | { kind: 'undo' | 'pause' | 'resume' };
export type CityReply = { message: string; action?: CityReplyAction };

/** Local, deliberately bounded interpretation. Unknown/negated requests never edit. */
export function interpretCityReply(input: string, journey: PlannedJourney): CityReply {
  const text = input.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'.\s]/g, ' ').trim();
  const id = journey.blocked?.id;
  const reason = journey.blocked ? journey.blockedExplanation : 'Your robot is not blocked. You can pause, resume, or undo the last city change.';
  if (!text) return { message: 'I didn’t hear a reply. Try again, type a reply, or use the city choices.' };
  if (/\b(don't|dont|do not|never|not|no|cancel|stop listening|without|instead|remove the ramp|raise the bridge|raise the curb|raise the kerb)\b/.test(text)) return { message: 'No city change made. Tell me what you would like to change.' };
  if (/\b(undo|change my mind|put it back)\b/.test(text)) return { message: 'Undo the last city change.', action: { kind: 'undo' } };
  if (/\b(ask|get)\b.*\b(robot|somebody|someone)\b.*\b(press|push)\b.*\bbutton\b/.test(text)) {
    return journey.nearbyHelp ? { message: 'Nearby robot pressed the crossing button.', action: { kind: 'ask-robot' } }
      : { message: 'No nearby robot can press this button right now. You can change the city or wait for help.' };
  }
  if (/\b(why|explain|what can|how can|help|what happened)\b/.test(text)) return { message: reason };
  if (/^(do|does|is|are|would|should|what|which|where|how)\b/.test(text)) return { message: reason };
  if (/\b(go around|another route|turn left|turn right)\b/.test(text)) return { message: 'Changing the route during a journey is not available yet. You can change the blocked place or wait.' };
  if (/^(please )?(pause|stop|wait)( the robot| for.*)?$/.test(text)) return { message: 'Pause the journey.', action: { kind: 'pause' } };
  if (/^(please )?(resume|continue|carry on|go ahead)( the journey| the robot)?$/.test(text)) return { message: 'Resume the journey.', action: { kind: 'resume' } };
  if (!id) return { message: reason };
  if (id.startsWith('robot:')) return { message: 'Another robot is in the way. We can wait for it to move; no city change is needed.' };
  const street = journey.world.streets.find(item => item.id === id);
  const requests = [
    /\b(ramp|steps|stairs|elevator|elevators|lift|lifts)\b/.test(text), /\b(curb|kerb)\b/.test(text),
    /\b(bridge)\b/.test(text), /\b(beeper|beep|tactile|cues)\b/.test(text),
    /\b(button|panel)\b/.test(text), /\b(wider|widen|width|wide|room)\b/.test(text),
    /\b(crossing time|more time|longer|seconds)\b/.test(text), /\b(bike|bicycle)\b/.test(text),
    /\b(door|entrance)\b/.test(text), /\b(directions|guidance|route cues)\b/.test(text),
  ];
  // A single request may describe both a door and its width, or route cues.
  const count = requests.filter(Boolean).length - (requests[5] && requests[8] ? 1 : 0) - (requests[3] && requests[9] ? 1 : 0);
  if (count > 1 || /\b(then|also|and (wait|pause|resume|continue|add|move|make|lower|give))\b/.test(text)) return { message: 'Let’s change one thing at a time. Which change would you like first?' };
  if (/\b(remove|take away|raise|higher|narrow|shorter)\b/.test(text) && !requests[7]) return { message: 'No city change made. Use the city choices to try a different setting.' };
  if (!/\b(add|put|make|move|lower|widen|give|increase|extend|open|clear|fix|repair|need|can|could|please|remove|change)\b/.test(text)) return { message: 'Tell me the change you want, for example “add a ramp” or “make it wider”.' };
  if (/\b(fix|repair)\b/.test(text) && count === 0) return { message: 'What would you like to change? Use the city choices beside the barrier for ideas.' };
  if (requests[0] && street && isHumpbackBridge(street, journey.world)) return { message: 'Bridge access updated.', action: { kind: 'bridge-access', id, access: /\b(elevator|elevators|lift|lifts)\b/.test(text) ? 'elevator' : 'ramp' } };
  if (requests[0] && street?.kind === 'stairs' || requests[1] && street?.kind === 'curb' || requests[2] && street?.kind === 'bridge' || requests[9] && street?.kind === 'guidance') return { message: 'City setting updated.', action: { kind: 'feature', id } };
  if (requests[3] && street?.kind === 'crossing') return { message: 'Beeper and tactile crossing cues added.', action: { kind: 'feature', id: `signals:${id}` } };
  if (requests[4] && street?.kind === 'crossing') return { message: 'Crossing button panel lowered.', action: { kind: 'dimension', id: `panel:${id}`, value: Math.min(.8, robotButtonReach(journey.bot)) } };
  const number = text.match(/\b(\d+(?:\.\d+)?)\s*(metres?|meters?|m|seconds?|s)\b/);
  if (number && (requests[5] && /^(seconds?|s)$/.test(number[2]!) || requests[6] && /^(metres?|meters?|m)$/.test(number[2]!))) return { message: 'Use metres for width and seconds for crossing time. No change made.' };
  if (/\b\d/.test(text) && !number) return { message: 'Please include the unit: metres for width or seconds for crossing time.' };
  if (requests[6] && street?.kind === 'crossing') return {
    message: 'Crossing time changed.', action: { kind: 'dimension', id: `crossing:${id}`, value: number ? Number(number[1]) : Math.max(street.crossingSeconds + 1, journey.crossingLength(street) / journey.speed + 1) },
  };
  if (requests[5] && (street || id === 'studio-entrance')) {
    const target = id === 'studio-entrance' ? 'studio:width' : `width:${id}`;
    return { message: 'Passage widened.', action: { kind: 'dimension', id: target, value: number ? Number(number[1]) : Math.max(journey.dimensions.get(target)! + .2, robotFootprint(journey.bot) + .2) } };
  }
  if (requests[7] && /\b(move|remove|clear|put)\b/.test(text) && journey.world.bicycles?.some(bike => bike.id === id)) return { message: 'Bicycle moved into the garage.', action: { kind: 'repair', id } };
  if (requests[8] && id === 'studio-entrance') return { message: 'Studio entrance changed.', action: { kind: 'repair', id } };
  return { message: `${reason} Choose a change for this barrier, or ask “why are you stuck?”.` };
}

export function applyCityReply(journey: PlannedJourney, reply: CityReply): string {
  const action = reply.action;
  if (!action) return reply.message;
  if (journey.complete) return 'This journey is complete. No city change made.';
  let changed = false;
  switch (action.kind) {
    case 'ask-robot': return journey.askNearbyRobot() ? `${reply.message} Wait for a safe green light before crossing.` : 'The helper is no longer available. You can lower the panel or wait for help.';
    case 'undo': changed = journey.undoRepair(); break;
    case 'pause': case 'resume':
      if (journey.ready) return 'Start the robot with Start robot when you’re ready.';
      journey.setPaused(action.kind === 'pause'); return action.kind === 'pause' ? 'Journey paused.' : 'Journey resumed. The robot will continue when the route is clear.';
    case 'bridge-access': changed = journey.setBridgeAccess(action.id, action.access); break;
    case 'feature': changed = journey.setFeature(action.id, true); break;
    case 'repair': changed = journey.repair(action.id); break;
    case 'dimension': {
      const limits = journey.dimensions.limits(action.id);
      if (!limits || action.value < limits.min || action.value > limits.max) return 'That size is outside this city’s limits. No change made. Use the size control to choose an available value.';
      changed = journey.editDimension(action.id, action.value); break;
    }
  }
  return changed ? `${reply.message} Undo lets you change your mind.${journey.blocked ? ' The robot may still need another change.' : ''}` : 'No change made. This setting may already be in place or unavailable while the robot is using it.';
}
