import { getLocaleID } from "../utils/locale";
import type { AgentEngine } from "./agent";

let chatHistory: Array<{ role: string; content: string }> = [];

let agentRef: AgentEngine | null = null;

export function setChatAgent(agent: AgentEngine): void {
  agentRef = agent;
}

function renderMessage(
  container: HTMLElement,
  msg: { role: string; content: string },
): void {
  const doc = container.ownerDocument;
  if (!doc) return;
  const bubble = doc.createElementNS("http://www.w3.org/1999/xhtml", "div") as unknown as HTMLElement;

  if (msg.role === "user") {
    bubble.style.cssText = "background:#4a90d9;color:white;padding:6px 10px;border-radius:12px 12px 0 12px;max-width:80%;margin:4px 0;margin-left:auto;display:block;text-align:right;font-size:13px;word-wrap:break-word;";
  } else if (msg.role === "status") {
    bubble.style.cssText = "text-align:center;font-style:italic;color:#999;font-size:11px;margin:4px 0;";
  } else {
    bubble.style.cssText = "background:#e8e8e8;color:#333;padding:6px 10px;border-radius:12px 12px 12px 0;max-width:80%;margin:4px 0;font-size:13px;white-space:pre-wrap;word-wrap:break-word;";
    if (msg.content.startsWith("Error: ")) {
      bubble.style.color = "#cc0000";
    }
  }
  bubble.textContent = msg.content;
  container.appendChild(bubble);
}

function scrollToBottom(el: HTMLElement): void {
  el.scrollTop = el.scrollHeight;
}

export function registerChatPanel(): void {
  Zotero.ItemPaneManager.registerSection({
    paneID: "researchhub-chat",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("chat-section-header"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
    },
    sidenav: {
      l10nID: getLocaleID("chat-section-sidenav"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
    },
    bodyXHTML: `
      <html:div xmlns:html="http://www.w3.org/1999/xhtml" style="display:flex;flex-direction:column;padding:8px;">
        <html:div
          id="researchhub-chat-messages"
          style="min-height:200px;max-height:400px;overflow-y:auto;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;background:#fafafa;"
        />
        <html:div
          id="researchhub-chat-status"
          style="display:none;font-style:italic;color:#666;margin-bottom:4px;font-size:12px;"
        />
        <html:div style="display:flex;align-items:center;">
          <html:input
            id="researchhub-chat-input"
            type="text"
            placeholder="Ask ResearchHub..."
            style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;"
          />
          <html:button
            id="researchhub-chat-send"
            style="padding:6px 12px;margin-left:4px;background:#4a90d9;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;"
          >Send</html:button>
        </html:div>
      </html:div>
    `,

    onItemChange({ item, setEnabled, tabType }: any) {
      setEnabled(true);
      return true;
    },

    onRender({ body }: any) {
      const messagesDiv = body.querySelector("#researchhub-chat-messages") as HTMLElement | null;
      const statusDiv = body.querySelector("#researchhub-chat-status") as HTMLElement | null;
      const inputEl = body.querySelector("#researchhub-chat-input") as HTMLInputElement | null;
      const sendBtn = body.querySelector("#researchhub-chat-send") as HTMLElement | null;

      if (!messagesDiv || !statusDiv || !inputEl || !sendBtn) return;

      // Rebuild chat history
      messagesDiv.innerHTML = "";
      for (const msg of chatHistory) {
        renderMessage(messagesDiv, msg);
      }
      scrollToBottom(messagesDiv);

      const handleSend = async () => {
        const value = inputEl.value.trim();
        if (!value) return;

        chatHistory.push({ role: "user", content: value });
        renderMessage(messagesDiv, { role: "user", content: value });
        inputEl.value = "";
        scrollToBottom(messagesDiv);

        statusDiv.style.display = "block";
        statusDiv.textContent = "Thinking...";

        if (!agentRef) {
          const errMsg = "Error: Chat agent is not initialized.";
          chatHistory.push({ role: "assistant", content: errMsg });
          renderMessage(messagesDiv, { role: "assistant", content: errMsg });
          statusDiv.style.display = "none";
          scrollToBottom(messagesDiv);
          return;
        }

        try {
          const result = await agentRef.run(value, (update: string) => {
            statusDiv.textContent = update;
          });
          chatHistory.push({ role: "assistant", content: result });
          renderMessage(messagesDiv, { role: "assistant", content: result });
        } catch (e: unknown) {
          const errContent = "Error: " + String(e);
          chatHistory.push({ role: "assistant", content: errContent });
          renderMessage(messagesDiv, { role: "assistant", content: errContent });
        } finally {
          statusDiv.style.display = "none";
          scrollToBottom(messagesDiv);
        }
      };

      sendBtn.addEventListener("click", handleSend);
      inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSend();
        }
      });
    },
  });
}

