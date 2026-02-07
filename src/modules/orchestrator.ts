export interface PluginStatus {
  linter: { available: boolean };
  zotseek: { available: boolean; ready: boolean };
}

export class Orchestrator {
  private status: PluginStatus = {
    linter: { available: false },
    zotseek: { available: false, ready: false },
  };

  async detectPlugins(): Promise<PluginStatus> {
    this.status.linter.available =
      typeof (Zotero as any).Linter !== "undefined";

    this.status.zotseek.available =
      typeof (Zotero as any).ZotSeek !== "undefined";

    if (this.status.zotseek.available) {
      try {
        this.status.zotseek.ready =
          await (Zotero as any).ZotSeek.api.isReady();
      } catch {
        this.status.zotseek.ready = false;
      }
    }

    ztoolkit.log(
      `Plugin detection: Linter=${this.status.linter.available}, ZotSeek=${this.status.zotseek.available} (ready=${this.status.zotseek.ready})`,
    );

    return this.status;
  }

  /** Re-detect on demand (handles load-order issues) */
  async refreshDetection(): Promise<PluginStatus> {
    return this.detectPlugins();
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  canFixCitations(): boolean {
    return this.status.linter.available;
  }

  canSemanticSearch(): boolean {
    return this.status.zotseek.available;
  }

  canSummarize(): boolean {
    return true; // Always available (LLM service is built-in)
  }

  canCheckOpenAccess(): boolean {
    return true; // Always available (uses Unpaywall API directly)
  }
}
