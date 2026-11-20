# Workers

- Models load ONLY inside Web Workers, never on the main thread.
- Protocol: In { id, type: load|run|abort, part, payload }, Out { id, type: progress|result|chunk|error, payload }
- Audio and vectors go as Transferable ArrayBuffers, never copied.
- Abort: rejecting with ABORTED, terminate worker, leave no half-loaded model.
- Tier names are ONLY: tiny, small, full.
- Errors are always typed CircleError, never raw string or Error.
