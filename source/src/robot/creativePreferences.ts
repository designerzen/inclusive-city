import type { PainterStyle, MusicianStyle } from '../art/artistStyles';
export interface CreativePreferences {
  artStyle: PainterStyle | 'expressive';
  musicStyle: MusicianStyle;
  medium: 'painting' | 'music';
}
