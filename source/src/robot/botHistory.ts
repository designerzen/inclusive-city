import { defaultAbilities } from './abilities';
import { defaultAppearance, randomiseAppearance } from './appearance';
import { createRobotProfile, defaultFunctions } from './functions';
import type { RobotAppearance } from './appearance';
import type { RobotProfile } from './functions';
import { createRobotRecord, robotMetadata } from './robotState';
import type { RobotRecord } from './robotState';
import type { CreativePreferences } from './creativePreferences';
import { presetDesign } from './presets';

export interface ArtBot {
  id: number;
  name: string;
  appearance: RobotAppearance;
  profile: RobotProfile;
  record: RobotRecord;
  presetId?: string;
  creative?: CreativePreferences;
}

// Cache logical designs rather than meshes; only the current bot is rendered.
export class BotHistory {
  private bots: ArtBot[];
  private cursor = 0;

  constructor(private scientistNames: readonly string[], private random = Math.random) {
    if (scientistNames.length < 2) throw new Error('At least two scientist surnames are required.');
    const design = { id: 1, name: this.chooseName(), appearance: defaultAppearance(), profile: createRobotProfile(defaultAbilities(), defaultFunctions()) };
    this.bots = [{ ...design, record: createRobotRecord(design) }];
  }

  private chooseName(previous?: string): string {
    const candidates = this.scientistNames.filter(name => name !== previous);
    return candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))]!;
  }

  get current(): ArtBot { return this.bots[this.cursor]!; }
  get position(): number { return this.cursor + 1; }
  get count(): number { return this.bots.length; }
  get canGoBack(): boolean { return this.cursor > 0; }

  selectPreset(presetId: string): ArtBot {
    let index = this.bots.findIndex(bot => bot.presetId === presetId);
    if (index === -1) {
      const design = presetDesign(presetId, this.bots.length + 1);
      this.bots.push({ ...design, record: createRobotRecord(design) });
      index = this.bots.length - 1;
    }
    this.cursor = index;
    return this.current;
  }

  next(): ArtBot {
    if (this.cursor === this.bots.length - 1) {
      const design = {
        id: this.bots.length + 1,
        name: this.chooseName(this.current.name),
        appearance: randomiseAppearance(this.current.appearance, this.random),
        profile: structuredClone(this.current.profile),
        ...(this.current.creative ? { creative: structuredClone(this.current.creative) } : {}),
      };
      this.bots.push({ ...design, record: createRobotRecord(design) });
    }
    this.cursor++;
    return this.current;
  }

  previous(): ArtBot {
    if (this.canGoBack) this.cursor--;
    return this.current;
  }

  rename(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) throw new Error('Enter a name between 1 and 60 characters.');
    this.current.name = trimmed;
    this.current.record.metadata = robotMetadata(this.current);
    return trimmed;
  }

  updateProfile(profile: RobotProfile) {
    this.current.profile = structuredClone(profile);
    this.current.creative = { medium: this.current.creative?.medium ?? 'painting', artStyle: profile.artist.painter, musicStyle: profile.artist.musician };
    this.current.record.metadata = robotMetadata(this.current);
  }
}
