import type { RobotCondition, RobotMood } from './robotCondition';
export type CharacterMood = RobotMood;
export type CharacterReaction = 'launch' | 'surprise' | 'relief' | 'pickup' | 'celebrate' | 'turn';
export interface CharacterPose {
  stretch: number; lift: number; lean: number; twist: number;
  headYaw: number; headTilt: number; headLift: number; headStretch: number;
  arms: number; armWave: number; antenna: number;
  eyeWidth: number; eyeHeight: number; brow: number; smile: number; mouthOpen: number;
  eyeTilt: number; eyeLid: number; eyeCurve: number; eyeAsymmetry: number;
  accent: number;
}
const durations: Record<CharacterReaction, number> = { launch: 0.9, surprise: 1.4, relief: 1.2, pickup: 0.85, celebrate: 1.8, turn: 0.65 };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const pulse = (t: number, start: number, duration: number) => Math.sin(clamp((t - start) / duration) * Math.PI);

// Authored poses use anticipation, fast action, holds, and damped follow-through.
// This controller is cosmetic: it never changes the robot's navigation or metrics.
export class CharacterAnimation {
  mood: CharacterMood = 'curious';
  condition: RobotCondition | null = null;
  private clock = 0;
  private reaction: { type: CharacterReaction; time: number; direction: number } | null = null;
  private feedback: { change: EditorFeedback; time: number } | null = null;
  feel(change: EditorFeedback) {
    const old = this.feedback;
    const same = old && old.change.type === change.type && 'id' in old.change && 'id' in change && old.change.id === change.id;
    this.feedback = { change: { ...change }, time: same ? Math.min(old.time, .35) : 0 };
    this.reaction = null;
    this.mood = 'curious';
  }
  react(type: CharacterReaction, direction = 1) {
    if (type === 'turn' && this.reaction) return;
    this.feedback = null;
    this.reaction = { type, time: 0, direction: Math.sign(direction) || 1 };
  }
  reset() { this.clock = 0; this.reaction = null; this.feedback = null; this.mood = 'curious'; this.condition = null; }
  tick(seconds: number, moving: boolean, reducedMotion = false): CharacterPose {
    this.clock += seconds;
    const p: CharacterPose = { stretch: 1, lift: 0, lean: 0, twist: 0, headYaw: 0, headTilt: 0, headLift: 0, headStretch: 1, arms: 0, armWave: 0, antenna: 0, eyeWidth: 1, eyeHeight: 1, brow: 0, smile: 0, mouthOpen: 0, eyeTilt: -.08, eyeLid: 0, eyeCurve: 0, eyeAsymmetry: .1, accent: 0 };
    const fatigue = (this.condition?.fatigue ?? (this.mood === 'tired' ? 80 : 0)) / 100;
    const frustration = (this.condition?.frustration ?? (this.mood === 'frustrated' ? 80 : 0)) / 100;
    if (this.mood === 'sad' || this.mood === 'tired' || this.mood === 'frustrated') {
      p.stretch = .96; p.lean = .07; p.headTilt = .12; p.headLift = -.12;
      p.brow = -.28; p.smile = -1; p.eyeHeight = .7; p.arms = -.15;
      p.eyeTilt = -.26; p.eyeLid = .45; p.eyeAsymmetry = 0;
    } else if (this.mood === 'happy' || this.mood === 'celebrating') {
      p.smile = 1; p.brow = .1; p.arms = .3; p.eyeHeight = .8;
      p.eyeTilt = .1; p.eyeCurve = 1.1; p.eyeAsymmetry = 0;
    }
    // Heavy lids, a drooping head and antenna, and less energetic motion.
    p.eyeHeight *= 1 - fatigue * .55; p.eyeLid = Math.max(p.eyeLid, fatigue * .75);
    p.headLift -= fatigue * .18; p.headTilt += fatigue * .15;
    p.lean += fatigue * .09; p.antenna += fatigue * .4; p.arms -= fatigue * .2;
    if (frustration > .05) {
      p.brow = .45 * frustration; p.smile = -frustration;
      p.eyeTilt = .3 * frustration; p.eyeLid = Math.max(p.eyeLid, frustration * .65);
      p.eyeCurve = 0; p.eyeAsymmetry = 0;
      if (!reducedMotion) { p.headYaw += Math.sin(this.clock * 5) * frustration * .12; p.twist += Math.sin(this.clock * 7) * frustration * .025; }
    }
    if (this.feedback) {
      const feedback = this.feedback;
      feedback.time += seconds;
      const r = feedback.time;
      const envelope = pulse(r, 0, 1.1);
      const spring = Math.sin(r * 12) * Math.exp(-r * 3);
      const change = feedback.change;
      p.smile = .6;
      p.eyeCurve = .3;
      if (change.type === 'reset') {
        p.headTilt = -.1 * envelope; p.arms = .45 * envelope; p.eyeHeight = .8;
      } else if (change.type === 'ability') {
        const up = change.value > change.previous;
        switch (change.id) {
          case 'speed':
            p.lean = (up ? -.14 : .08) * envelope;
            p.headYaw = (up ? .3 * spring : .08 * envelope);
            p.headTilt = up ? -.08 * envelope : .12 * envelope;
            p.antenna = up ? spring * .3 : 0;
            break;
          case 'agility':
            p.twist = up ? spring * .3 : 0;
            p.arms = (up ? .8 : .2) * envelope;
            p.headTilt = up ? spring * .15 : -.08 * envelope;
            break;
          case 'visualDetail':
            p.eyeWidth = up ? .7 : 1.25;
            p.eyeHeight = up ? .65 : 1.1;
            p.brow = up ? .2 : -.1;
            p.eyeLid = up ? .65 : 0; p.eyeTilt = up ? .16 : -.14;
            p.eyeCurve = 0; p.eyeAsymmetry = up ? 0 : .2;
            p.headYaw = (up ? .08 : .4) * spring;
            break;
          case 'reach':
            p.arms = (up ? 1.15 : -.22) * envelope;
            p.headLift = (up ? .12 : -.06) * envelope;
            p.stretch = 1 + (up ? .08 : -.05) * envelope;
            break;
          case 'burstPower':
            p.arms = (up ? 1.45 : .3) * envelope;
            p.stretch = 1 + (up ? .12 : -.04) * envelope;
            p.headTilt = (up ? -.1 : .1) * envelope;
            p.accent = up ? envelope * .7 : 0;
            break;
        }
      } else {
        // React to the targeted module; the automatic swap stays atomic in the profile.
        const strength = change.enabled ? 1 : .55;
        switch (change.id) {
          case 'communication': p.lean = -.12 * envelope * strength; p.arms = .6 * envelope; break;
          case 'vision': p.eyeWidth = change.enabled ? 1.3 : .85; p.headYaw = spring * .25; break;
          case 'hearing': p.antenna = spring * .55 * strength; p.headTilt = .18 * envelope; break;
          case 'memory': p.headTilt = -.16 * envelope; p.brow = -.15; p.eyeHeight = .75; break;
          case 'balance': p.arms = .8 * envelope; p.twist = spring * .12 * strength; break;
        }
      }
      if (r >= 1.1) this.feedback = null;
      if (reducedMotion) return { ...p, stretch: 1, lift: 0, lean: 0, twist: 0, headYaw: 0, headTilt: 0, headLift: 0, antenna: 0, arms: 0, accent: 0 };
      return p;
    }
    if (reducedMotion) {
      this.reaction = null;
      return { ...p, stretch: 1, lean: 0, headTilt: 0, headLift: 0 };
    }
    const t = this.clock;
    if (!this.reaction) {
      const blinkTime = t % 4.7;
      p.eyeHeight *= 1 - .96 * pulse(blinkTime, 4.35, .18);
      if (this.mood === 'curious' && !moving) {
        p.headYaw = Math.sin(t * .7) * .15;
        p.headTilt = Math.sin(t * .5) * .05;
      }
      if (this.mood === 'celebrating') {
        p.twist = Math.sin(t * 3) * .12;
        p.arms = 1.45;
        p.armWave = Math.sin(t * 5) * .22;
      }
      return p;
    }
    const reaction = this.reaction;
    reaction.time += seconds;
    const r = reaction.time;
    const recoil = Math.sin(r * 19) * Math.exp(-r * 4);
    switch (reaction.type) {
      case 'launch': {
        const crouch = pulse(r, 0, .25), spring = pulse(r, .18, .45);
        p.stretch += -.18 * crouch + .16 * spring;
        p.lean = .15 * crouch - .13 * spring;
        p.headLift = .1 * spring;
        p.arms = -.25 * crouch + .35 * spring;
        p.antenna = recoil * .22;
        break;
      }
      case 'surprise': {
        const pop = pulse(r, .08, .65);
        p.stretch += pop * .28;
        p.headStretch = 1 + pop * .35;
        p.headLift += pop * .28;
        p.eyeWidth = 1 + pop * .65;
        p.eyeHeight = 1 + pop * .7;
        p.eyeTilt *= 1 - pop; p.eyeLid *= 1 - pop;
        p.eyeCurve *= 1 - pop; p.eyeAsymmetry *= 1 - pop;
        p.mouthOpen = pop;
        p.accent = pop;
        // First look, opposite look, then overshoot and settle: the double take.
        p.headYaw = r < .22 ? .5 * pulse(r, 0, .22) : r < .65 ? -.65 * pulse(r, .22, .43) : Math.sin((r - .65) * 18) * Math.exp(-(r - .65) * 6) * .25;
        p.arms = pop * 1.25;
        p.antenna = Math.sin(r * 22) * Math.exp(-r * 2) * .35;
        break;
      }
      case 'relief':
      case 'celebrate': {
        const crouch = pulse(r, 0, .24), leap = pulse(r, .18, .7);
        p.stretch += -.22 * crouch + .2 * leap;
        p.lift = leap * .25;
        p.accent = leap;
        p.arms = 1.7 * leap;
        p.armWave = recoil * .2;
        p.headTilt = recoil * .15;
        p.twist = recoil * .2;
        p.smile = 1;
        p.eyeCurve = 1.1; p.eyeTilt = .1; p.eyeLid = 0; p.eyeAsymmetry = 0;
        p.antenna = Math.sin(r * 17 - .4) * Math.exp(-r * 3) * .25;
        break;
      }
      case 'pickup': {
        const reach = pulse(r, 0, .28), pop = pulse(r, .16, .5);
        p.lean = -.12 * reach;
        p.headStretch = 1 + pop * .16;
        p.headLift = .15 * pop;
        p.accent = pop;
        p.eyeWidth = 1 + .25 * pop;
        p.arms = .7 * reach + pop;
        p.smile = 1;
        p.eyeCurve = .65 * pop; p.eyeTilt = .1 * pop; p.eyeLid = 0;
        p.antenna = recoil * .25;
        break;
      }
      case 'turn':
        p.headYaw = reaction.direction * Math.sin(r * 7) * Math.exp(-r * 3) * .45;
        p.lean = -reaction.direction * Math.sin(r * 7) * Math.exp(-r * 4) * .08;
        p.antenna = -p.headYaw * .35;
        break;
    }
    if (r >= durations[reaction.type]) this.reaction = null;
    return p;
  }
}
import type { EditorFeedback } from './editorFeedback';
