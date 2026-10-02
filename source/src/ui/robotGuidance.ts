import type { CityJourney } from '../simulation/cityJourney';
import type { BarrierId } from '../city/cityLayout';
import { cityBarriers } from '../city/cityLayout';
import { describeFeature, featureNames } from '../city/cityDocument';

const issues: Record<BarrierId, string> = {
  transport: 'There’s no accessible transport on this route! Add a ride and I’m ready to roll.',
  curb: 'This curb is too high for my wheels! Lower it and the crossing is back on the menu.',
  crossing: 'This signal changes too quickly for me to cross safely! More crossing time, more time to enjoy the view.',
  guidance: 'This junction is missing clear route cues! Audio and tactile directions will keep this explorer on track.',
  sidewalk: 'This pavement is too narrow for me to fit through! A little more room and we’re rolling.',
  bridge: 'This raised bridge leaves a gap in my route! Lower it and my riverside adventure can continue.',
  stairs: 'These steps block the way for my wheels! Add a ramp and it’s onward and upward.',
  elevator: 'There’s no working elevator to the upstairs gallery! Get it running and next stop: art.',
};
export function robotGuidance(journey: CityJourney, id: BarrierId, help: boolean) {
  if (!journey.canEdit(id)) return `I’m using this part of the city. Let me move clear before changing it. You can choose another feature while you wait.`;
  const blocked = journey.blocked?.id === id;
  if (blocked || help) {
    if (journey.inaccessibleFeature(id)) return `${issues[id]} Choose “${cityBarriers.find(item => item.id === id)!.action}” ${blocked ? 'below' : 'in the hint below'} to open up the route. The map will update straight away.`;
    return `I can use ${featureNames[id].toLowerCase()} with these settings. You can still experiment, or ${journey.ready ? 'start' : journey.complete ? 'try' : 'continue'} the journey to test your city.`;
  }
  const test = journey.ready ? 'Start journey' : journey.complete ? 'Try again' : 'Resume journey';
  return `Let’s explore ${featureNames[id].toLowerCase()}. ${describeFeature(journey.city, id)}. Use the buttons below to change it, or choose “Help me decide” for a hint. Then choose “${test}” to test your idea.`;
}
