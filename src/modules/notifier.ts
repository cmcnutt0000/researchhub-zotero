import { getPref } from "../utils/prefs";

export function registerNotifier(): string {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: number[] | string[],
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) return;

      // Only handle item add events
      if (event !== "add" || type !== "item") return;

      // Delay to let other plugins process first
      await Zotero.Promise.delay(1000);

      const items = (ids as number[])
        .map((id) => Zotero.Items.get(id))
        .filter(
          (item): item is Zotero.Item =>
            !!item && item.isRegularItem() && !(item as any).isFeedItem,
        );

      if (items.length === 0) return;

      // Auto-lint on import
      if (
        getPref("integrations.autoLintOnImport") &&
        addon.data.orchestrator?.canFixCitations()
      ) {
        try {
          // Check if Linter has its own auto-lint to avoid double-processing
          const linterAutoLint = Zotero.Prefs.get(
            "extensions.zotero.linter.lint.onAdded",
          );
          if (!linterAutoLint) {
            await addon.data.linterBridge?.fixCitations(items);
          }
        } catch {
          // If we can't read Linter prefs, trigger anyway
          await addon.data.linterBridge?.fixCitations(items);
        }
      }

      // Auto-check OA status
      if (getPref("integrations.openAccess") && addon.data.oaChecker) {
        addon.data.oaChecker.checkItems(items).catch(() => {});
      }

      // Auto-summarize (off by default as it uses LLM tokens)
      if (getPref("integrations.autoSummarize") && addon.data.llmService) {
        for (const item of items) {
          try {
            await addon.data.llmService.summarizeAndStore(item);
          } catch {
            // Non-critical, continue with next item
          }
        }
      }

      // Index in ZotSeek for future search
      if (addon.data.orchestrator?.canSemanticSearch()) {
        addon.data.zotseekBridge?.indexItems(items).catch(() => {});
      }
    },
  };

  const notifierID = Zotero.Notifier.registerObserver(callback, ["item"]);

  // Auto-unregister on plugin shutdown
  Zotero.Plugins.addObserver({
    shutdown: ({ id }: { id: string }) => {
      if (id === addon.data.config.addonID) {
        Zotero.Notifier.unregisterObserver(notifierID);
      }
    },
  });

  return notifierID;
}
