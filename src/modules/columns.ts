import { getPref } from "../utils/prefs";

export async function registerOAColumn(): Promise<void> {
  if (!getPref("oa.showColumn")) return;

  await Zotero.ItemTreeManager.registerColumns({
    pluginID: addon.data.config.addonID,
    dataKey: "researchhub-oa-status",
    label: "Access",
    dataProvider: (item: Zotero.Item, _dataKey: string) => {
      const doi = item.getField("DOI") as string;
      if (!doi) return "";

      const cached = addon.data.oaChecker?.cache.get(doi);
      if (!cached) {
        // Fire and forget — column refreshes on next paint
        addon.data.oaChecker?.checkItem(item).catch(() => {});
        return "...";
      }
      return cached.isOpenAccess ? "Open" : "Closed";
    },
    renderCell(
      index: number,
      data: string,
      column: any,
      _isFirstColumn: boolean,
      doc: Document,
    ) {
      const span = doc.createElement("span");
      span.className = `cell ${column.className}`;
      span.style.display = "flex";
      span.style.alignItems = "center";
      span.style.gap = "4px";

      if (data === "Open") {
        span.style.color = "#2e7d32";
        span.textContent = "\u{1F513} Open";
      } else if (data === "Closed") {
        span.style.color = "#c62828";
        span.textContent = "\u{1F512} Closed";
      } else if (data === "...") {
        span.style.color = "#757575";
        span.textContent = "...";
      } else {
        span.textContent = "--";
      }
      return span;
    },
  });
}
