/** SentencePiece BPE with the identity normalizer used by NeuDecide's export.
 * Implemented from the Apache-2.0 model's tokenizer specification; no website code is bundled.
 */
export interface TokenizerSpec {
  model_type: string; unk_id: number; byte_fallback?: boolean;
  add_dummy_prefix?: boolean; remove_extra_whitespaces?: boolean; escape_whitespaces?: boolean;
  pieces: [string, number, string][];
}
export class NeuTokenizer {
  private ids = new Map<string, number>();
  private bytes = new Map<number, number>();
  private user: string[];
  constructor(private spec: TokenizerSpec) {
    if (spec.model_type !== 'bpe') throw new Error('Unsupported NeuDecide tokenizer');
    spec.pieces.forEach(([piece, , type], id) => {
      if (type === 'NORMAL' || type === 'USER_DEFINED') this.ids.set(piece, id);
      if (type === 'BYTE') this.bytes.set(parseInt(piece.slice(3, 5), 16), id);
    });
    this.user = spec.pieces.filter(p => p[2] === 'USER_DEFINED').map(p => p[0]).sort((a, b) => b.length - a.length);
  }
  encode(input: string): number[] {
    let text = this.spec.remove_extra_whitespaces === false ? input : input.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
    if (!text) return [];
    if (this.spec.add_dummy_prefix !== false) text = ' ' + text;
    if (this.spec.escape_whitespaces !== false) text = text.replace(/ /g, '▁');
    const symbols: string[] = [];
    for (let i = 0; i < text.length;) {
      const symbol = this.user.find(piece => text.startsWith(piece, i)) ?? String.fromCodePoint(text.codePointAt(i)!);
      symbols.push(symbol); i += symbol.length;
    }
    // Tool descriptions are short and bounded. A simple priority scan preserves
    // SentencePiece's highest-score / leftmost tie rule without a second runtime.
    while (true) {
      let best = -1, score = -Infinity;
      for (let i = 0; i + 1 < symbols.length; i++) {
        if (this.user.includes(symbols[i]!) || this.user.includes(symbols[i + 1]!)) continue;
        const id = this.ids.get(symbols[i]! + symbols[i + 1]!);
        if (id !== undefined && this.spec.pieces[id]![1] > score) { best = i; score = this.spec.pieces[id]![1]; }
      }
      if (best < 0) break;
      symbols.splice(best, 2, symbols[best]! + symbols[best + 1]!);
    }
    return symbols.flatMap(symbol => {
      const id = this.ids.get(symbol);
      if (id !== undefined) return [id];
      return this.spec.byte_fallback ? [...new TextEncoder().encode(symbol)].map(byte => this.bytes.get(byte) ?? this.spec.unk_id) : [this.spec.unk_id];
    });
  }
  decode(ids: number[]): string {
    let output = '', bytes: number[] = [];
    const flush = () => { output += new TextDecoder().decode(new Uint8Array(bytes)); bytes = []; };
    for (const id of ids) {
      const piece = this.spec.pieces[id];
      if (!piece) throw new Error('Invalid NeuDecide token');
      if (piece[2] === 'CONTROL') continue;
      if (piece[2] === 'BYTE') { bytes.push(parseInt(piece[0].slice(3, 5), 16)); continue; }
      flush(); output += piece[2] === 'UNKNOWN' ? ' ⁇ ' : piece[0].replace(/▁/g, ' ');
    }
    flush();
    return this.spec.add_dummy_prefix !== false && output.startsWith(' ') ? output.slice(1) : output;
  }
}
/** Tool definitions contain only strings, arrays and objects. Python's default separators and ASCII escaping. */
export function serializeTools(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (Array.isArray(value)) return `[${value.map(serializeTools).join(', ')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${serializeTools(key)}: ${serializeTools(item)}`).join(', ')}}`;
  return JSON.stringify(value);
}
