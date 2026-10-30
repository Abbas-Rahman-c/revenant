---
inclusion: always
---

# Local AI: verified facts only

This file is the single source of truth for model IDs, library versions and API calls. It exists because coding agents invent local-AI APIs. **The rule: if it is not written here, look it up before using it.**

## Rules for writing local-AI code

1. **Never guess** a model ID, a library function or an option name. Check this file first. If it is missing, read the library's current official docs or source (or ask the `circle-mcp` server once it exists), then **add the verified entry here** before writing the code.
2. Every entry records: the library and exact version, the model ID, its approximate download size, the tier, and a minimal working snippet that has been run.
3. If a snippet stops working after an upgrade, fix this file first, then the code.
4. Prefer models with permissive licenses (Apache-2.0, MIT). Record the license.

## Verified entries

> Empty until verified. Fill one entry per model kind during week 1 and 2, after running each snippet in a real browser.

### Template

```
Kind:       speech-to-text | llm | tts | vision | embeddings | depth
Library:    <package>@<exact version>
Model ID:   <exact id>
Size:       ~<MB> download
Tier:       tiny | small | full
License:    <license>
Verified:   <date>, <browser + GPU it was run on>
Snippet:
  <the smallest code that loads the model and runs one inference>
Gotchas:
  <anything surprising: required flags, memory spikes, slow first run>
```
