type Gate = {
  promise: Promise<void>;
  resolve: () => void;
  resolved: boolean;
};

const gates = new Map<string, Gate>();

function createId(): string {
  // Prefer crypto UUID when available (modern browsers).
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `shutter_${(crypto as Crypto).randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `shutter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a one-time "gate" promise that can be resolved later by ID.
 * Used to keep the shutter closed across navigation until the battle client is ready.
 */
export function createShutterGate(): { id: string; promise: Promise<void> } {
  const id = createId();

  let resolveFn: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });

  const gate: Gate = {
    promise,
    resolved: false,
    resolve: () => {
      if (gate.resolved) return;
      gate.resolved = true;
      try {
        resolveFn?.();
      } finally {
        resolveFn = null;
        gates.delete(id);
      }
    },
  };

  gates.set(id, gate);
  return { id, promise };
}

export function resolveShutterGate(id: string): void {
  const gate = gates.get(id);
  gate?.resolve();
}

export function getShutterGatePromise(id: string): Promise<void> | null {
  return gates.get(id)?.promise ?? null;
}


