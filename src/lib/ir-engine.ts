/**
 * IRRemoteEngine — the only place that talks to the IR hardware.
 *
 * UI components ask the engine for supported commands and hand it a command
 * name or an AC state; they never build patterns themselves.
 */
import { Ir, isNativeRuntime } from "./ir-bridge";
import type { CodeSet, IrKey } from "./ir-catalog";
import { keysFor } from "./ir-catalog";
import type { SavedIrRemote } from "./ir-devices";
import { codeSetFor } from "./ir-devices";
import { carrierOf, irCarrierRanges, irEmitterAvailable, lastIrSignal, sendIrKey, sendIrPattern } from "./ir-remote";
import { acProfileFor, type AcProfile, type AcState } from "./ac-protocols";

export interface IrResult {
  ok: boolean;
  message: string;
}

export const IRRemoteEngine = {
  isNative: isNativeRuntime,

  checkEmitter: irEmitterAvailable,

  getCarrierFrequencies: irCarrierRanges,

  /** Discrete code set for a saved remote (null when the database changed). */
  loadProfile(remote: SavedIrRemote): CodeSet | null {
    return codeSetFor(remote);
  },

  /** Stateful AC profile, when this appliance/brand has one. */
  loadAcProfile(remote: SavedIrRemote): AcProfile | null {
    return remote.kind === "ac" ? acProfileFor(remote.brand) : null;
  },

  getSupportedCommands(set: CodeSet | null): IrKey[] {
    return set ? keysFor(set) : [];
  },

  async sendCommand(remote: SavedIrRemote, command: IrKey): Promise<IrResult> {
    const set = codeSetFor(remote);
    if (!set) return { ok: false, message: "This saved remote is no longer available" };
    if (set.codes[command] === undefined) {
      return { ok: false, message: "This code set does not support that button" };
    }
    return sendIrKey(set, command, { brand: remote.brand, kind: remote.kind });
  },

  /** Builds and transmits the complete AC frame for the given state. */
  async sendAcState(
    remote: SavedIrRemote,
    profile: AcProfile,
    state: AcState,
    command = "AC_STATE",
  ): Promise<IrResult> {
    const pattern = profile.build(state);
    return sendIrPattern(profile.frequency, pattern, {
      command,
      brand: remote.brand,
      kind: remote.kind,
      codeSet: profile.label,
    });
  },

  async transmitRaw(frequency: number, pattern: number[], command = "raw"): Promise<IrResult> {
    return sendIrPattern(frequency, pattern, { command });
  },

  async getDiagnostics(remote?: SavedIrRemote) {
    const [emitter, ranges] = await Promise.all([irEmitterAvailable(), irCarrierRanges()]);
    const set = remote ? codeSetFor(remote) : null;
    return {
      native: isNativeRuntime(),
      emitter,
      ranges,
      carrier: set ? carrierOf(set) : null,
      commands: set ? keysFor(set).length : 0,
      acProfile: remote ? (acProfileFor(remote.brand)?.protocol ?? null) : null,
      last: lastIrSignal(),
    };
  },

  /** Exposed for the diagnostics panel. */
  bridge: Ir,
};
