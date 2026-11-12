/**
 * In-browser matplotlib runner for the admin Diagram Library.
 *
 * Loads Pyodide (CPython in WASM) + numpy + matplotlib from a CDN on demand,
 * then runs pasted matplotlib Python and harvests any SVG files the script
 * writes via `plt.savefig(...)`. Nothing is bundled into the app; the runtime
 * is fetched lazily only when the diagrams page asks for it, and cached by the
 * browser afterwards.
 *
 * There are no API keys or network calls to any model here - the pasted code
 * is produced elsewhere (e.g. Gemini) and only executed locally in the WASM
 * sandbox.
 */

const PYODIDE_VERSION = 'v0.27.2';
const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DiagramSvg {
  filename: string;
  svg: string;
}

export interface DiagramRunResult {
  svgs: DiagramSvg[];
  stdout: string;
  stderr: string;
  error: string | null;
}

interface MinimalPyodide {
  loadPackage: (names: string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<MinimalPyodide>;
  }
}

let pyodidePromise: Promise<MinimalPyodide> | null = null;
let statusListeners: Array<(status: PyodideStatus) => void> = [];
let currentStatus: PyodideStatus = 'idle';

// Reset per run; matplotlib/script output is appended here by the batched
// stdout/stderr collectors wired up once at init.
let stdoutBuffer = '';
let stderrBuffer = '';

function setStatus(status: PyodideStatus): void {
  currentStatus = status;
  for (const listener of statusListeners) listener(status);
}

export function getPyodideStatus(): PyodideStatus {
  return currentStatus;
}

export function onPyodideStatus(listener: (status: PyodideStatus) => void): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pyodide-loader="1"]`);
    if (existing) {
      if (window.loadPyodide) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Pyodide script')));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.pyodideLoader = '1';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Pyodide script')));
    document.head.appendChild(script);
  });
}

/**
 * Loads (or returns the in-flight/ready promise for) the Pyodide runtime with
 * numpy and matplotlib. Safe to call repeatedly.
 */
export function ensurePyodide(): Promise<MinimalPyodide> {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    setStatus('loading');
    try {
      await loadScriptOnce(`${PYODIDE_BASE_URL}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error('Pyodide loader was not available after script load.');
      }
      const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE_URL });

      // Wire stdout/stderr once; they append to module-level buffers that each
      // run resets before executing.
      pyodide.setStdout({ batched: (text: string) => { stdoutBuffer += text + '\n'; } });
      pyodide.setStderr({ batched: (text: string) => { stderrBuffer += text + '\n'; } });

      await pyodide.loadPackage(['numpy', 'matplotlib']);

      // Force the non-interactive SVG backend before any pyplot import so that
      // pasted scripts which do `import matplotlib.pyplot as plt` pick it up.
      await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use("svg")
# Render text as vector paths so the viewer doesn't depend on Arial being
# installed - the output stays pixel-faithful to the script.
matplotlib.rcParams["svg.fonttype"] = "path"
`);

      setStatus('ready');
      return pyodide;
    } catch (err) {
      setStatus('error');
      pyodidePromise = null; // allow a retry
      throw err;
    }
  })();

  return pyodidePromise;
}

/** Python that runs after the user's script to collect SVGs from the cwd. */
const HARVEST_CODE = `
import os, glob, json
import matplotlib.pyplot as _plt
_result = {}
for _f in sorted(glob.glob("*.svg")):
    try:
        with open(_f, "r", encoding="utf-8") as _fh:
            _result[_f] = _fh.read()
    except Exception as _e:
        pass
_plt.close("all")
json.dumps(_result)
`;

/**
 * Runs the pasted matplotlib script in an isolated working directory and
 * returns any SVGs it produced plus captured stdout/stderr. Never throws for
 * script errors - the Python error message is returned in `error`.
 */
export async function runDiagramScript(code: string): Promise<DiagramRunResult> {
  const pyodide = await ensurePyodide();

  stdoutBuffer = '';
  stderrBuffer = '';

  // Fresh working directory per run so stale SVGs from a previous run are not
  // harvested.
  const runDir = `/diagram_runs/run_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await pyodide.runPythonAsync(`
import os
os.makedirs(${JSON.stringify(runDir)}, exist_ok=True)
os.chdir(${JSON.stringify(runDir)})
# Reset backend/state each run in case a prior script mutated rcParams.
import matplotlib
matplotlib.use("svg")
`);

  let error: string | null = null;
  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  let svgs: DiagramSvg[] = [];
  try {
    const harvestJson = (await pyodide.runPythonAsync(HARVEST_CODE)) as string;
    const parsed = JSON.parse(harvestJson) as Record<string, string>;
    svgs = Object.entries(parsed).map(([filename, svg]) => ({ filename, svg }));
  } catch (err) {
    // Harvest failing is only fatal if the script itself did not already error.
    if (!error) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    svgs,
    stdout: stdoutBuffer.trim(),
    stderr: stderrBuffer.trim(),
    error,
  };
}
