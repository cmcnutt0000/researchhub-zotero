import { getString } from "../utils/locale";

export function registerMenus(): void {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;

  // Right-click context menu on items: ResearchHub submenu
  ztoolkit.Menu.register("item", {
    tag: "menu",
    label: getString("menu-researchhub"),
    icon: menuIcon,
    children: [
      {
        tag: "menuitem",
        label: getString("menu-fix-citations"),
        commandListener: async () => {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (!items.length || !addon.data.linterBridge) return;

          const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName)
            .createLine({ text: `Fixing ${items.length} citation(s)...`, type: "default", progress: 0 })
            .show();

          const result = await addon.data.linterBridge.fixCitations(items);
          pw.changeLine({
            text: result.errors.length > 0
              ? `Errors: ${result.errors.join(", ")}`
              : `Fixed ${result.fixed} citation(s)`,
            type: result.errors.length > 0 ? "fail" : "success",
            progress: 100,
          });
          pw.startCloseTimer(3000);
        },
      },
      {
        tag: "menuitem",
        label: getString("menu-summarize-all"),
        commandListener: async () => {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (!items.length || !addon.data.llmService) return;

          const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
            closeOnClick: true,
            closeTime: -1,
          })
            .createLine({ text: `Summarizing ${items.length} item(s)...`, type: "default", progress: 0 })
            .show();

          let done = 0;
          for (const item of items) {
            if (!item.isRegularItem()) continue;
            try {
              await addon.data.llmService.summarizeAndStore(item);
            } catch (e) {
              ztoolkit.log("Summarize error:", e);
            }
            done++;
            pw.changeLine({
              text: `Summarized ${done}/${items.length}`,
              progress: Math.round((done / items.length) * 100),
            });
          }

          pw.changeLine({
            text: `Summarized ${done} item(s)`,
            type: "success",
            progress: 100,
          });
          pw.startCloseTimer(3000);
        },
      },
      {
        tag: "menuitem",
        label: getString("menu-check-oa"),
        commandListener: async () => {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (!items.length || !addon.data.oaChecker) return;

          const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName)
            .createLine({ text: `Checking OA status for ${items.length} item(s)...`, type: "default", progress: 0 })
            .show();

          const results = await addon.data.oaChecker.checkItems(items);
          const oaCount = Array.from(results.values()).filter(
            (s) => s.isOpenAccess,
          ).length;

          pw.changeLine({
            text: `${oaCount} Open Access / ${results.size - oaCount} Closed`,
            type: "success",
            progress: 100,
          });
          pw.startCloseTimer(3000);
        },
      },
      {
        tag: "menuitem",
        label: getString("menu-find-similar"),
        commandListener: async () => {
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
        tag: "menuitem",
        label: getString("menu-synthesize"),
        commandListener: async () => {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (items.length < 2 || !addon.data.llmService) return;

          const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
            closeOnClick: true,
            closeTime: -1,
          })
            .createLine({ text: "Synthesizing papers...", type: "default", progress: 50 })
            .show();

          try {
            const synthesis = await addon.data.llmService.synthesize(items);
            pw.changeLine({ text: synthesis, type: "success", progress: 100 });
          } catch (e) {
            pw.changeLine({ text: `Error: ${e}`, type: "fail", progress: 100 });
          }
        },
      },
    ],
  });

  // Tools menu entry
  ztoolkit.Menu.register("menuTools", {
    tag: "menuseparator",
  });
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    label: "ResearchHub Settings",
    commandListener: () => {
      Zotero.getActiveZoteroPane().openPreferences(addon.data.config.addonID);
    },
  });
}
