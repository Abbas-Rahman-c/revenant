---
inclusion: always
---

# Local AI: verified facts only

This file is the single source of truth for model IDs, library versions and API calls. It exists because coding agents invent local-AI APIs. **The rule: if it is not written here, look it up before using it.**

## Rules for writing local-AI code

1. **Never guess** a model ID, a library function or an option name.
2. Use only the model IDs, versions and API calls listed below.
3. If you need something not listed here, verify it in the official README / model card first, then add it here with its measured numbers.
4. Do not invent fallbacks. Use only the fallbacks listed below.

## Voice - VERIFIED in Playground on 2026-11-19

- Package: kokoro-js 1.2.1
- Model ID: onnx-community/Kokoro-82M-v1.0-ONNX
- Voice: af_heart
- Device: wasm, dtype q8
- Status: VERIFIED in circle/playground/
- Model loaded in: 77197 ms
- Generated in: 9434 ms
- Audio: 47400 samples, 24000 Hz
- Duration: 1.98 sec
- Fallback if Kokoro fails: Xenova/speecht5_tts
- Per-tier decision: Full tier = Kokoro local. Lite tier = no TTS, text only. Fallback tier = speecht5 or text only.

## Memory - VERIFIED in Playground on 2026-11-19

- Package: @huggingface/transformers 4.3.2
- Model ID: Xenova/all-MiniLM-L6-v2
- Status: VERIFIED in circle/playground/
- Model loaded in: 1785 ms
- Embedding size: 384 dims
- Measured: "I love cats" vs "I love dogs" similarity = 0.757 (HIGH, correct)
- Measured: "I love cats" vs "Quantum physics is hard" similarity = 0.051 (LOW, correct)
- Pooling: mean, normalize: true
- Fallback if MiniLM fails: Xenova/bge-small-en-v1.5
- Per-tier decision: Full tier = MiniLM local embeddings. Lite tier = keyword match only, no embeddings. Fallback tier = bge-small or keyword match.

## Rule

Do not invent model IDs or API calls. Use only the IDs above, verified in the playground with measured numbers.