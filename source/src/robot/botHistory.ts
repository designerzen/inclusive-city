import { newShellId } from './shellIdentity';
import { defaultAbilities } from './abilities';
import { defaultAppearance, randomiseAppearance } from './appearance';
import { createRobotProfile, defaultFunctions } from './functions';
import type { RobotAppearance } from './appearance';
import type { RobotProfile } from './functions';
import { createRobotRecord, robotMetadata } from './robotState';
import type { RobotRecord } from './robotState';
import type { CreativePreferences } from './creativePreferences';
import { presetDesign, robotPresets } from './presets';
import { loadDesigns, saveDesigns } from './designStorage';
import type { DesignStorage } from './designStorage';

export interface ArtBot {
  id: number;
  shellId?: string;
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
  private customName?: string;

  constructor(private scientistNames: readonly string[], private random = Math.random, private storage?: DesignStorage) {
    if (scientistNames.length < 2) throw new Error('At least two scientist surnames are required.');
    const saved = loadDesigns(storage);
    if (saved) {
      const used = new Set<string>();
      this.bots = saved.bots.map(old => {
        const id = old.shellId && !used.has(old.shellId) ? old.shellId : newShellId(); used.add(id);
        const design = { ...old, shellId: id }; return { ...design, record: createRobotRecord(design) };
      });
      this.cursor = saved.cursor;
      this.customName = saved.customName;
      // Older saves did not distinguish manual names from generated names.
      const defaultName = robotPresets.find(preset => preset.id === this.current.presetId)?.name;
      if (this.customName === undefined && this.current.name !== defaultName && !scientistNames.includes(this.current.name)) {
        this.customName = this.current.name;
      }
      this.save();
      return;
    }
    const design = { shellId: newShellId(), id: 1, name: this.chooseName(), appearance: defaultAppearance(), profile: createRobotProfile(defaultAbilities(), defaultFunctions()) };
    this.bots = [{ ...design, record: createRobotRecord(design) }];
    this.save();
  }

  private save() { saveDesigns(this.storage, this.bots, this.cursor, this.customName); }

  private preserveName() {
    if (this.customName !== undefined) this.setName(this.customName);
  }

  private chooseName(previous?: string): string {
    const candidates = this.scientistNames.filter(name => name !== previous);
    return candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))]!;
  }

  get current(): ArtBot { return this.bots[this.cursor]!; }
  get all(): readonly ArtBot[] { return this.bots; }
  get position(): number { return this.cursor + 1; }
  get count(): number { return this.bots.length; }
  get canGoBack(): boolean { return this.cursor > 0; }

  selectPreset(presetId: string): ArtBot {
    let index = this.bots.findIndex(bot => bot.presetId === presetId);
    if (index === -1) {
      const design = { ...presetDesign(presetId, this.bots.length + 1), shellId: newShellId() };
      this.bots.push({ ...design, record: createRobotRecord(design) });
      index = this.bots.length - 1;
    }
    this.cursor = index;
    this.preserveName();
    this.save();
    return this.current;
  }

  next(): ArtBot {
    if (this.cursor === this.bots.length - 1) {
      const design = {
        id: this.bots.length + 1, shellId: newShellId(),
        name: this.customName ?? this.chooseName(this.current.name),
        appearance: randomiseAppearance(this.current.appearance, this.random),
        profile: structuredClone(this.current.profile),
        ...(this.current.creative ? { creative: structuredClone(this.current.creative) } : {}),
      };
      this.bots.push({ ...design, record: createRobotRecord(design) });
    }
    this.cursor++;
    this.preserveName();
    this.save();
    return this.current;
  }

  previous(): ArtBot {
    if (this.canGoBack) this.cursor--;
    this.preserveName();
    this.save();
    return this.current;
  }

  randomiseName(): string {
    const name = this.chooseName(this.current.name);
    if (this.customName !== undefined) this.customName = name;
    this.setName(name);
    this.save();
    return name;
  }

  rename(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) throw new Error('Enter a name between 1 and 60 characters.');
    this.customName = trimmed;
    this.setName(trimmed);
    this.save();
    return trimmed;
  }

  private setName(name: string) {
    this.current.name = name;
    this.current.record.metadata = robotMetadata(this.current);
  }

  updateAppearance(appearance: ArtBot['appearance']) {
    this.current.appearance = structuredClone(appearance);
    this.current.record.metadata = robotMetadata(this.current);
    this.save();
  }

  updateProfile(profile: RobotProfile) {
    const artStyle = this.current.creative && this.current.profile.artist.painter === profile.artist.painter
      ? this.current.creative.artStyle : profile.artist.painter;
    this.current.profile = structuredClone(profile);
    this.current.creative = { medium: this.current.creative?.medium ?? 'painting', artStyle, musicStyle: profile.artist.musician };
    this.current.record.metadata = robotMetadata(this.current);
    this.save();
  }
}
