export interface SearchResult {
  item: Zotero.Item;
  score: number;
  [key: string]: any;
}

export class ZotSeekBridge {
  /** Semantic search across the user's library */
  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<SearchResult[]> {
    await this.ensureAvailable();
    await this.ensureReady();
    return (Zotero as any).ZotSeek.api.search(query, options);
  }

  /** Find papers similar to a given item */
  async findSimilar(
    itemId: number,
    options?: { limit?: number },
  ): Promise<SearchResult[]> {
    await this.ensureAvailable();
    await this.ensureReady();
    return (Zotero as any).ZotSeek.api.findSimilar(itemId, options);
  }

  /** Index items (useful after bulk import) */
  async indexItems(items: Zotero.Item[]): Promise<void> {
    if (typeof (Zotero as any).ZotSeek === "undefined") return;
    try {
      await (Zotero as any).ZotSeek.api.indexItems(items);
    } catch (e) {
      ztoolkit.log("ZotSeekBridge.indexItems error:", e);
    }
  }

  private async ensureAvailable(): Promise<void> {
    if (typeof (Zotero as any).ZotSeek === "undefined") {
      await addon.data.orchestrator?.refreshDetection();
    }
    if (typeof (Zotero as any).ZotSeek === "undefined") {
      throw new Error("ZotSeek plugin is not installed.");
    }
  }

  private async ensureReady(): Promise<void> {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (await (Zotero as any).ZotSeek.api.isReady()) return;
      } catch {
        // not ready yet
      }
      await Zotero.Promise.delay(2000);
    }
    throw new Error(
      "ZotSeek index is not ready. Please wait for indexing to complete.",
    );
  }
}
