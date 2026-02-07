export class LinterBridge {
  /** Fix citations for items using the Linter plugin's standard rules */
  async fixCitations(items: Zotero.Item[]): Promise<{ fixed: number; errors: string[] }> {
    // Lazy re-detect in case Linter loaded after us
    if (typeof (Zotero as any).Linter === "undefined") {
      await addon.data.orchestrator?.refreshDetection();
    }

    if (typeof (Zotero as any).Linter === "undefined") {
      return { fixed: 0, errors: ["Linter plugin is not installed."] };
    }

    try {
      await (Zotero as any).Linter.hooks.onLintInBatch("standard", items);
      return { fixed: items.length, errors: [] };
    } catch (e) {
      ztoolkit.log("LinterBridge.fixCitations error:", e);
      return { fixed: 0, errors: [String(e)] };
    }
  }

  /** Apply a specific Linter rule to an item */
  async applyRule(item: Zotero.Item, ruleID: string): Promise<void> {
    if (typeof (Zotero as any).Linter === "undefined") return;
    await (Zotero as any).Linter.runner.applyRuleByID(item, ruleID, {});
  }
}
