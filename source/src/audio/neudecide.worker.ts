import * as ort from 'onnxruntime-web/wasm';
import { NeuTokenizer, serializeTools } from './neudecideTokenizer';
import type { TokenizerSpec } from './neudecideTokenizer';
import type { SpokenTool } from '../ui/citySpokenActions';

interface Config {
  sample_rate: number; max_audio_seconds: number; max_tools_len: number; max_answer_len: number;
  num_decoder_layers: number; num_kv_heads: number; head_dim: number;
  special_tokens: Record<string, number>;
  variants: { q4: { graphs: Record<string, string> } };
}
let config: Config, tokenizer: NeuTokenizer;
const sessions: Record<string, ort.InferenceSession> = {};
async function bytes(base: string, file: string) {
  if (!/^[\w.-]+\.(json|onnx)$/.test(file)) throw new Error('Invalid model filename');
  const url = new URL(file, base).href;
  const cache = typeof caches === 'undefined' ? undefined : await caches.open('neudecide-q4-fb0157e-v1');
  const cached = await cache?.match(url);
  if (cached) return new Uint8Array(await cached.arrayBuffer());
  const response = await fetch(url);
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('NeuDecide model files are unavailable. Use the on-screen choices or type a prompt.');
  const result = new Uint8Array(await response.arrayBuffer());
  if (!result.length) throw new Error('Empty model file');
  await cache?.put(url, new Response(result.slice()));
  return result;
}
async function load(base: string, runtime: string) {
  ort.env.wasm.wasmPaths = runtime;
  ort.env.wasm.numThreads = 1;
  config = JSON.parse(new TextDecoder().decode(await bytes(base, 'config.json')));
  if (config.sample_rate !== 16000 || !config.variants?.q4 || config.max_audio_seconds !== 30) throw new Error('Unsupported NeuDecide model configuration');
  tokenizer = new NeuTokenizer(JSON.parse(new TextDecoder().decode(await bytes(base, 'tokenizer.json'))) as TokenizerSpec);
  for (const key of ['audio_encoder', 'tool_encoder', 'decoder_step']) {
    self.postMessage({ type: 'status', text: `Preparing on-device commands: ${key.replace(/_/g, ' ')}…` });
    sessions[key] = await ort.InferenceSession.create(await bytes(base, config.variants.q4.graphs[key]!), { executionProviders: ['wasm'] });
  }
}
async function generate(waveform: Float32Array, tools: SpokenTool[]) {
  if (!waveform.length || waveform.length > 16000 * 30) throw new Error('Keep one command under 30 seconds. No change made.');
  const ids = [config.special_tokens.tools!, ...tokenizer.encode(serializeTools(tools))];
  if (tools.length > 10 || ids.length > config.max_tools_len) throw new Error('Too many command choices');
  const int = (values: number[], shape: number[]) => new ort.Tensor('int64', BigInt64Array.from(values, BigInt), shape);
  const audio = await sessions.audio_encoder!.run({ waveform: new ort.Tensor('float32', waveform, [1, waveform.length]), waveform_len: int([waveform.length], [1]) });
  const encoded = await sessions.tool_encoder!.run({ audio_embeds: audio.audio_embeds!, audio_len: audio.audio_len!, tools_ids: int(ids, [1, ids.length]) });
  const empty = () => new ort.Tensor('float32', new Float32Array(), [config.num_decoder_layers, 1, config.num_kv_heads, 0, config.head_dim]);
  let pastKey: ort.Tensor = empty(), pastValue: ort.Tensor = empty(), token = config.special_tokens.eos!;
  const output: number[] = [];
  for (let step = 0; step < config.max_answer_len; step++) {
    const decoded = await sessions.decoder_step!.run({ input_ids: int([token], [1, 1]), past_key: pastKey, past_value: pastValue,
      cross_key: encoded.cross_key!, cross_value: encoded.cross_value!, encoder_mask: encoded.encoder_mask! });
    const logits = decoded.logits!.data as Float32Array;
    token = 0;
    for (let i = 1; i < logits.length; i++) if (logits[i]! > logits[token]!) token = i;
    pastKey.dispose(); pastValue.dispose(); pastKey = decoded.present_key!; pastValue = decoded.present_value!;
    decoded.logits!.dispose();
    if (token === config.special_tokens.eos) {
      pastKey.dispose(); pastValue.dispose();
      Object.values(audio).forEach(t => t.dispose()); Object.values(encoded).forEach(t => t.dispose());
      const structural = new Set(Object.values(config.special_tokens));
      return JSON.parse(tokenizer.decode(output.filter(id => !structural.has(id))));
    }
    output.push(token);
  }
  throw new Error('The command was incomplete. Please try one change at a time.');
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') { await load(data.base, data.runtime); self.postMessage({ type: 'ready' }); }
    if (data.type === 'run') self.postMessage({ type: 'result', calls: await generate(data.waveform, data.tools) });
  } catch (error) { self.postMessage({ type: 'error', text: error instanceof Error ? error.message : 'Commands could not run on this device.' }); }
};
