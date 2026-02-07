import { Orchestrator } from "./modules/orchestrator";
import { LinterBridge } from "./modules/linter-bridge";
import { ZotSeekBridge } from "./modules/zotseek-bridge";
import { LLMService } from "./modules/llm-service";
import { OpenAccessChecker } from "./modules/open-access";
import { registerOAColumn } from "./modules/columns";
import { registerItemPaneSection } from "./modules/item-pane-section";
import { registerMenus } from "./modules/menus";
import { registerCommands } from "./modules/command-palette";
import { registerNotifier } from "./modules/notifier";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { AgentEngine } from "./modules/agent";
import { registerChatPanel, setChatAgent } from "./modules/chat-panel";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Initialize module instances
  addon.data.orchestrator = new Orchestrator();
  addon.data.linterBridge = new LinterBridge();
  addon.data.zotseekBridge = new ZotSeekBridge();
  addon.data.llmService = new LLMService();
  addon.data.oaChecker = new OpenAccessChecker();

  // Initialize agent engine
  addon.data.agent = new AgentEngine(
    addon.data.llmService!,
    addon.data.zotseekBridge!,
    addon.data.linterBridge!,
    addon.data.oaChecker!,
  );
  setChatAgent(addon.data.agent);

  // Detect available plugins
  await addon.data.orchestrator.detectPlugins();

  // Register preference pane
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });

  // Register OA column
  await registerOAColumn();

  // Register chat panel
  registerChatPanel();

  // Register item pane section
  registerItemPaneSection();

  // Register notifier for auto-triggers on import
  addon.data.notifierID = registerNotifier();

  // Process all main windows
  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  // Load localization into window
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Register UI components
  registerMenus();
  registerCommands();

  // Insert stylesheet
  const doc = win.document;
  ztoolkit.UI.createElement(doc, "link", {
    properties: {
      type: "text/css",
      rel: "stylesheet",
      href: `chrome://${addon.data.config.addonRef}/content/researchhubPane.css`,
    },
  });

  // Show startup notification
  const status = addon.data.orchestrator?.getStatus();
  const parts = [];
  if (status?.linter.available) parts.push("Linter");
  if (status?.zotseek.available) parts.push("ZotSeek");
  const integrations =
    parts.length > 0 ? `Integrations: ${parts.join(", ")}` : "Standalone mode";

  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
  })
    .createLine({
      text: `Ready. ${integrations}`,
      type: "success",
      progress: 100,
    })
    .show()
    .startCloseTimer(4000);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
