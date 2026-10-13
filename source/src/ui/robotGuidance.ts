import type { CityJourney } from '../simulation/cityJourney';
import type { BarrierId } from '../city/cityLayout';
import { cityBarriers } from '../city/cityLayout';
import { describeFeature, featureNames } from '../city/cityDocument';

const issues: Record<BarrierId, string> = {
  communication: 'Pictures can help me ask for what I need! Let’s add a symbol board before our adventure.',
  curb: 'This curb is too high for my wheels! Let’s lower it so I can roll across.',
  crossing: 'I need more time to cross safely! Let’s make the green light last longer.',
  guidance: 'Which way shall I go? Sounds and signs I can feel will help me find the way!',
  sidewalk: 'This pavement is too narrow for me! Let’s make room so I can roll through.',
  bridge: 'The bridge is raised, so I can’t cross yet! Let’s lower it and keep exploring.',
  stairs: 'My wheels can’t climb these steps! Let’s add a ramp so I can join in.',
  elevator: 'Let’s visit the art upstairs! I need a working lift to get there.',
};
export function robotGuidance(journey: CityJourney, id: BarrierId, help: boolean) {
  if (!journey.canEdit(id)) return `I’m still here! Wait until I move away before changing this part. You can explore another part while you wait.`;
  const blocked = journey.blocked?.id === id;
  if (blocked || help) {
    if (journey.inaccessibleFeature(id)) return `${issues[id]} Choose “${cityBarriers.find(item => item.id === id)!.action}” ${blocked ? 'below' : 'in the hint below'} to open up the route. The map will update straight away.`;
    return `Hooray! I can use ${featureNames[id].toLowerCase()} like this. Keep trying ideas, or ${journey.ready ? 'start' : journey.complete ? 'try' : 'continue'} our journey to see what happens!`;
  }
  const test = journey.ready ? 'Start journey' : journey.complete ? 'Try again' : 'Resume journey';
  return `Let’s explore ${featureNames[id].toLowerCase()}. ${describeFeature(journey.city, id)}. Use the buttons below to change it, or choose “Help me decide” for a hint. Then choose “${test}” to test your idea.`;
}
