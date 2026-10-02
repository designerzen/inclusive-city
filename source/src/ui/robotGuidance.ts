import type { CityJourney } from '../simulation/cityJourney';
import type { BarrierId } from '../city/cityLayout';
import { cityBarriers } from '../city/cityLayout';
import { describeFeature, featureNames } from '../city/cityDocument';

const issues: Record<BarrierId, string> = {
  transport: 'My drive is switched off, so I need accessible transport to carry me.',
  curb: 'This curb is too high for my wheels. A lowered curb will let me reach the crossing.',
  crossing: 'I need more time to cross safely before the signal changes.',
  guidance: 'I need clearer route information. Audio and tactile cues can help me find my way.',
  sidewalk: 'This pavement is too narrow for my body. I need more room to pass.',
  bridge: 'The raised bridge leaves a gap in my route. Lowering it will let me cross the river.',
  stairs: 'My wheels cannot climb these steps. A ramp will help me reach the next level.',
  elevator: 'The gallery is upstairs, and I need a working elevator to get there.',
};
export function robotGuidance(journey: CityJourney, id: BarrierId, help: boolean) {
  if (!journey.canEdit(id)) return `I’m using this part of the city. Let me move clear before changing it. You can choose another feature while you wait.`;
  const blocked = journey.blocked?.id === id;
  if (blocked || help) {
    if (journey.inaccessibleFeature(id)) return `${blocked ? 'I need your help! ' : ''}${issues[id]} Choose “${cityBarriers.find(item => item.id === id)!.action}” ${blocked ? 'below' : 'in the hint below'} to help me. The map will update straight away.`;
    return `I can use ${featureNames[id].toLowerCase()} with these settings. You can still experiment, or ${journey.ready ? 'start' : journey.complete ? 'try' : 'continue'} the journey to test your city.`;
  }
  const test = journey.ready ? 'Start journey' : journey.complete ? 'Try again' : 'Resume journey';
  return `Let’s explore ${featureNames[id].toLowerCase()}. ${describeFeature(journey.city, id)}. Use the buttons below to change it, or choose “Help me decide” for a hint. Then choose “${test}” to test your idea.`;
}
