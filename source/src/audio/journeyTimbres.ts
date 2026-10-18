import type { MusicianStyle } from '../art/artistStyles';
import type { SoundScore } from './SoundEffect';
import { timbres } from './timbres';
import { fmPatches } from './fmSynth';

const leads: Partial<Record<MusicianStyle, keyof typeof timbres>> = {
  melodic: 'mallet', ambient: 'air', classical: 'piano', minimalist: 'mallet',
  jazz: 'electric', blues: 'reed', electronic: 'acid', chimes: 'glass', folk: 'nylon',
  waltz: 'reed', latin: 'nylon', cinematic: 'strings', lofi: 'electric', baroque: 'wire',
  romantic: 'piano', ragtime: 'piano', funk: 'clav', reggae: 'organ', disco: 'brass', dnb: 'air',
  afrobeat: 'brass', highlife: 'nylon', soukous: 'wire', mbalax: 'mallet', ethiojazz: 'electric',
  amapiano: 'electric', gnawa: 'pickedBass', rai: 'acid', maqam: 'nylon', turkish: 'wire',
  persian: 'glass', raga: 'wire', qawwali: 'reed', gamelan: 'steel', koto: 'wire',
  guzheng: 'wire', korean: 'nylon', irish: 'flute', flamenco: 'nylon', klezmer: 'reed',
  balkan: 'brass', tango: 'reed', argentineTango: 'reed', samba: 'mallet', salsa: 'piano',
  cumbia: 'flute', merengue: 'reed', calypso: 'steel', soca: 'brass', bluegrass: 'wire',
  rock: 'clav', hiphop: 'electric', trap: 'glass',
};

/** Contrast the arrangement roles without replacing a style's rhythm or pitches.
 * Donk and chip voices retain their established oscillator character.
 */
function selectTimbre(style: MusicianStyle, role: 'lead' | 'harmony' | 'bass' | 'counter'): Partial<SoundScore['voice']> {
  if (style === 'techno' || style === 'chiptune') return {};
  const lead = leads[style];
  if (role === 'lead') {
    if (style === 'electronic') return { ...timbres.acid, fm: fmPatches.bright };
    if (style === 'lofi') return { ...timbres.electric, cutoff: 1200, release: .45 };
    if (style === 'rock') return { ...timbres.clav, sustain: .4, release: .18, cutoff: 3800 };
    if (style === 'synthwave') return { filterEnvelope: { octaves: 1.8, decay: .3 } };
    return lead ? timbres[lead] : {};
  }
  if (role === 'bass') {
    if (['trap', 'hiphop', 'reggae', 'amapiano'].includes(style)) return timbres.roundBass;
    if (['electronic', 'synthwave', 'dnb'].includes(style)) return { ...timbres.acid, cutoff: 550, resonance: 1.2 };
    return timbres.pickedBass;
  }
  if (role === 'counter') return ['reed', 'brass', 'strings', 'air'].includes(lead ?? '') ? timbres.nylon : timbres.flute;
  if (['ambient', 'cinematic', 'romantic', 'dnb', 'raga'].includes(style)) return timbres.strings;
  if (['jazz', 'lofi', 'ethiojazz', 'hiphop', 'amapiano'].includes(style)) return timbres.electric;
  if (['reggae', 'blues', 'qawwali'].includes(style)) return timbres.organ;
  if (['gamelan', 'calypso', 'persian', 'chimes'].includes(style)) return timbres.mallet;
  if (['electronic', 'synthwave', 'disco', 'soca'].includes(style)) return { ...timbres.brass, attack: .012, release: .14 };
  return ['nylon', 'wire', 'mallet', 'clav'].includes(lead ?? '') ? timbres.electric : timbres.nylon;
}

export function journeyTimbre(style: MusicianStyle, role: 'lead' | 'harmony' | 'bass' | 'counter'): Partial<SoundScore['voice']> {
  const voice = selectTimbre(style, role);
  // Replacing an FM recipe with a harmonic spectrum must clear the old modulator.
  return voice.partials ? { fm: undefined, ...voice } : voice;
}
