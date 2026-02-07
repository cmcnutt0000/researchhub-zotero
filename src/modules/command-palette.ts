import { getString } from "../utils/locale";

export function registerCommands(): void {
  ztoolkit.Prompt.register([
    {
      name: "Fix Citations",
      label: "ResearchHub",
      when: () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        return items.length > 0;
      },
      callback: async () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (!items.length || !addon.data.linterBridge) return;
        await addon.data.linterBridge.fixCitations(items);
        new ztoolkit.ProgressWindow(addon.data.config.addonName)
          .createLine({ text: `Fixed ${items.length} citation(s)`, type: "success" })
          .show();
      },
    },
    {
      name: "Summarize Selected",
      label: "ResearchHub",
      when: () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        return items.length > 0;
      },
      callback: async () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (!items.length || !addon.data.llmService) return;
        for (const item of items) {
          if (item.isRegularItem()) {
            await addon.data.llmService.summarizeAndStore(item);
          }
        }
        new ztoolkit.ProgressWindow(addon.data.config.addonName)
          .createLine({ text: `Summarized ${items.length} item(s)`, type: "success" })
          .show();
      },
    },
    {
      name: "Check Open Access",
      label: "ResearchHub",
      when: () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        return items.length > 0;
      },
      callback: async () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (!items.length || !addon.data.oaChecker) return;
        await addon.data.oaChecker.checkItems(items);
        new ztoolkit.ProgressWindow(addon.data.config.addonName)
          .createLine({ text: "OA check complete", type: "success" })
          .show();
      },
    },
    {
      name: "Find Similar Papers",
      label: "ResearchHub",
      when: () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        return items.length === 1;
      },
      callback: async () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (items.length !== 1 || !addon.data.zotseekBridge) return;
        try {
          const results = await addon.data.zotseekBridge.findSimilar(
            items[0].id,
            { limit: 5 },
          );
          const pw = new ztoolkit.ProgressWindow("Similar Papers", {
            closeOnClick: true,
            closeTime: -1,
          });
          for (const r of results.slice(0, 5)) {
            const title = r.item?.getField?.("title") || "Unknown";
            pw.createLine({ text: title, type: "default" });
          }
          pw.show();
        } catch (e) {
          new ztoolkit.ProgressWindow(addon.data.config.addonName)
            .createLine({ text: String(e), type: "fail" })
            .show();
        }
      },
    },
    {
      name: "Synthesize Selected",
      label: "ResearchHub",
      when: () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        return items.length > 1;
      },
      callback: async () => {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (items.length < 2 || !addon.data.llmService) return;
        const synthesis = await addon.data.llmService.synthesize(items);
        new ztoolkit.ProgressWindow("Synthesis", {
          closeOnClick: true,
          closeTime: -1,
        })
          .createLine({ text: synthesis, type: "success" })
          .show();
      },
    },
  ]);
}
