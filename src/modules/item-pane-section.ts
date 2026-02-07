import { getLocaleID, getString } from "../utils/locale";
import { getStoredSummary } from "./llm-service";

export function registerItemPaneSection(): void {
  Zotero.ItemPaneManager.registerSection({
    paneID: "researchhub-panel",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-section-header"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
    },
    sidenav: {
      l10nID: getLocaleID("item-section-sidenav"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
    },
    bodyXHTML: `
      <html:div id="researchhub-section-body" xmlns:html="http://www.w3.org/1999/xhtml" style="padding: 8px; font-size: 13px;">
        <html:div id="researchhub-oa-badge" style="margin-bottom: 6px; font-weight: bold;"></html:div>
        <html:div id="researchhub-summary-text" style="color: #555; margin-bottom: 8px; line-height: 1.4;">
          Click "Summarize" to generate a summary.
        </html:div>
      </html:div>
    `,
    onItemChange: ({ item, setEnabled, tabType }) => {
      const isRegularItem = item && item.isRegularItem();
      setEnabled(!!isRegularItem);
      return true;
    },
    onRender: ({ body, item }) => {
      const summaryEl = body.querySelector(
        "#researchhub-summary-text",
      ) as HTMLElement;
      if (summaryEl) {
        summaryEl.textContent = "Loading...";
        summaryEl.style.fontStyle = "italic";
      }
    },
    onAsyncRender: async ({ body, item, setSectionSummary }) => {
      if (!item) return;

      // Show OA status
      const oaBadge = body.querySelector(
        "#researchhub-oa-badge",
      ) as HTMLElement;
      if (oaBadge && addon.data.oaChecker) {
        try {
          const oaStatus = await addon.data.oaChecker.checkItem(item);
          oaBadge.textContent = oaStatus.isOpenAccess
            ? "\u{1F513} Open Access"
            : "\u{1F512} Closed Access";
          oaBadge.style.color = oaStatus.isOpenAccess ? "#2e7d32" : "#c62828";
        } catch {
          oaBadge.textContent = "";
        }
      }

      // Show existing summary or prompt
      const summaryEl = body.querySelector(
        "#researchhub-summary-text",
      ) as HTMLElement;
      if (!summaryEl) return;

      const existingSummary = getStoredSummary(item);
      if (existingSummary) {
        summaryEl.textContent = existingSummary;
        summaryEl.style.fontStyle = "normal";
        summaryEl.style.color = "#333";
        setSectionSummary(existingSummary.substring(0, 80) + "...");
      } else {
        summaryEl.textContent =
          'No summary yet. Click "Summarize" to generate one.';
        summaryEl.style.fontStyle = "italic";
        summaryEl.style.color = "#888";
      }
    },
    sectionButtons: [
      {
        type: "summarize",
        icon: "chrome://zotero/skin/16/universal/note.svg",
        l10nID: getLocaleID("item-section-btn-summarize"),
        onClick: async ({ item, body }) => {
          const summaryEl = body.querySelector(
            "#researchhub-summary-text",
          ) as HTMLElement;
          if (!summaryEl || !addon.data.llmService) return;

          summaryEl.textContent = "Generating summary...";
          summaryEl.style.fontStyle = "italic";
          summaryEl.style.color = "#555";

          try {
            const summary =
              await addon.data.llmService.summarizeAndStore(item);
            summaryEl.textContent = summary;
            summaryEl.style.fontStyle = "normal";
            summaryEl.style.color = "#333";
          } catch (e) {
            summaryEl.textContent = `Error: ${e}`;
            summaryEl.style.color = "#c62828";
          }
        },
      },
      {
        type: "fix-citations",
        icon: "chrome://zotero/skin/16/universal/pencil.svg",
        l10nID: getLocaleID("item-section-btn-fix"),
        onClick: async ({ item }) => {
          if (!addon.data.linterBridge) return;
          const result = await addon.data.linterBridge.fixCitations([item]);
          const msg =
            result.errors.length > 0
              ? `Errors: ${result.errors.join(", ")}`
              : "Citations fixed!";
          new ztoolkit.ProgressWindow(addon.data.config.addonName)
            .createLine({ text: msg, type: result.errors.length > 0 ? "fail" : "success" })
            .show();
        },
      },
      {
        type: "find-similar",
        icon: "chrome://zotero/skin/16/universal/search.svg",
        l10nID: getLocaleID("item-section-btn-similar"),
        onClick: async ({ item }) => {
          if (!addon.data.zotseekBridge) return;
          try {
            const results = await addon.data.zotseekBridge.findSimilar(
              item.id,
              { limit: 5 },
            );
            const lines = results
              .map((r: any) => {
                const title = r.item?.getField?.("title") || "Unknown";
                return `• ${title} (score: ${(r.score * 100).toFixed(0)}%)`;
              })
              .join("\n");

            const pw = new ztoolkit.ProgressWindow(
              "Similar Papers",
              { closeOnClick: true, closeTime: -1 },
            );
            for (const r of results.slice(0, 5)) {
              const title =
                r.item?.getField?.("title") || "Unknown";
              pw.createLine({
                text: title,
                type: "default",
              });
            }
            pw.show();
          } catch (e) {
            new ztoolkit.ProgressWindow(addon.data.config.addonName)
              .createLine({ text: String(e), type: "fail" })
              .show();
          }
        },
      },
    ],
  });
}
