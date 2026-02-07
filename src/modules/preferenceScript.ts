import { getPref } from "../utils/prefs";
import { config } from "../../package.json";

export function registerPrefsScripts(win: Window) {
  const doc = win.document;
  const prefix = config.addonRef;

  const el = (id: string) =>
    doc.getElementById(`zotero-prefpane-${prefix}-${id}`) as HTMLElement | null;

  // Toggle visibility of Ollama vs Cloud fields based on provider
  function updateProviderFields() {
    const provider = getPref("llm.provider");
    const isOllama = provider === "ollama";

    const ollamaEndpointRow = el("ollama-endpoint-row");
    const ollamaModelRow = el("ollama-model-row");
    const apiKeyRow = el("api-key-row");
    const cloudModelRow = el("cloud-model-row");

    if (ollamaEndpointRow)
      ollamaEndpointRow.style.display = isOllama ? "" : "none";
    if (ollamaModelRow)
      ollamaModelRow.style.display = isOllama ? "" : "none";
    if (apiKeyRow) apiKeyRow.style.display = isOllama ? "none" : "";
    if (cloudModelRow) cloudModelRow.style.display = isOllama ? "none" : "";
  }

  // Update plugin detection status indicators
  function updatePluginStatus() {
    const linterStatus = el("linter-status");
    const zotseekStatus = el("zotseek-status");

    const status = addon.data.orchestrator?.getStatus();

    if (linterStatus) {
      linterStatus.textContent = status?.linter.available
        ? "Installed"
        : "Not detected";
      linterStatus.style.color = status?.linter.available
        ? "#2e7d32"
        : "#c62828";
    }

    if (zotseekStatus) {
      zotseekStatus.textContent = status?.zotseek.available
        ? "Installed"
        : "Not detected";
      zotseekStatus.style.color = status?.zotseek.available
        ? "#2e7d32"
        : "#c62828";
    }
  }

  // Test LLM connection button
  const testBtn = el("test-llm");
  const statusSpan = el("llm-status");

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      if (!statusSpan) return;
      statusSpan.textContent = "Testing...";
      statusSpan.style.color = "#555";

      try {
        const available = await addon.data.llmService?.isAvailable();
        if (available) {
          statusSpan.textContent = "Connected";
          statusSpan.style.color = "#2e7d32";
        } else {
          statusSpan.textContent = "Not reachable";
          statusSpan.style.color = "#c62828";
        }
      } catch (e) {
        statusSpan.textContent = `Error: ${e}`;
        statusSpan.style.color = "#c62828";
      }
    });
  }

  // Watch provider dropdown for changes
  const providerDropdown = el("llm-provider");
  if (providerDropdown) {
    providerDropdown.addEventListener("command", updateProviderFields);
  }

  // Initialize
  updateProviderFields();
  updatePluginStatus();
}
