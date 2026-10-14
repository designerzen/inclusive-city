# NeuDecide model installation

Download the authorised q4 export from https://huggingface.co/neuphonic/neudecide/tree/fb0157e06da16d887caf041ca7929f96da419e6b after obtaining access. Place these five files beside this README:

- config.json
- tokenizer.json
- audio_encoder_q4.onnx
- tool_encoder_q4.onnx
- decoder_step_q4.onnx

The model repository declares Apache-2.0. Preserve its licence and attribution when distributing downloaded assets. No Hugging Face token belongs in browser code. Alternatively set VITE_NEUDECIDE_MODEL_URL to a public, authorised folder for this same export, with CORS support. This folder must be immutable/versioned. Local files are recommended for deployment and offline use.

The runtime is pinned to onnxruntime-web 1.30.0 and bundled locally. Model files are fetched lazily and cached by version and URL. Cache reuse is not a verified whole-app offline guarantee. Live inference, tokenizer parity with Python and representative speaker/device evaluation remain required before claiming production readiness. Missing files produce a visible error; typed prompts and choices still work.
