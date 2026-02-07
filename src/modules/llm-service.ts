import { getPref } from "../utils/prefs";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMConfig {
  provider: string;
  endpoint: string;
  model: string;
  apiKey: string;
  maxTokens: number;
}

export class LLMService {
  private getConfig(): LLMConfig {
    const provider = getPref("llm.provider");
    if (provider === "ollama") {
      return {
        provider: "ollama",
        endpoint: getPref("llm.ollamaEndpoint"),
        model: getPref("llm.ollamaModel"),
        apiKey: "",
        maxTokens: getPref("llm.maxTokens"),
      };
    }

    const endpoints: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      openrouter: "https://openrouter.ai/api/v1",
    };

    return {
      provider,
      endpoint: endpoints[provider] || endpoints.openai,
      model: getPref("llm.cloudModel"),
      apiKey: getPref("llm.apiKey"),
      maxTokens: getPref("llm.maxTokens"),
    };
  }

  /** Summarize a paper in 1-2 sentences using its title + abstract */
  async summarize(item: Zotero.Item): Promise<string> {
    const title = item.getField("title") as string;
    const abstract = item.getField("abstractNote") as string;

    if (!abstract && !title) {
      return "No title or abstract available for summarization.";
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a research assistant. Summarize the following academic paper in exactly 1-2 clear sentences that capture the main contribution and findings. Be concise and precise.",
      },
      {
        role: "user",
        content: `Title: ${title}\n\nAbstract: ${abstract || "(no abstract available)"}`,
      },
    ];

    return this.chat(messages);
  }

  /** Summarize and store as a child note on the item */
  async summarizeAndStore(item: Zotero.Item): Promise<string> {
    const summary = await this.summarize(item);
    await storeSummary(item, summary);
    return summary;
  }

  /** Synthesize multiple papers into a brief overview */
  async synthesize(items: Zotero.Item[]): Promise<string> {
    const papers = items
      .map((item, i) => {
        const title = item.getField("title") as string;
        const abstract = item.getField("abstractNote") as string;
        return `[${i + 1}] ${title}\nAbstract: ${abstract || "(no abstract)"}`;
      })
      .join("\n\n");

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a research assistant. Synthesize the following papers into a brief paragraph identifying common themes, methodologies, and how they relate to each other.",
      },
      { role: "user", content: papers },
    ];

    return this.chat(messages);
  }

  /** Check if the LLM service is reachable */
  async isAvailable(): Promise<boolean> {
    const config = this.getConfig();
    if (config.provider === "ollama") {
      try {
        const resp = await Zotero.HTTP.request("GET", config.endpoint, {
          timeout: 3000,
        });
        return resp.status === 200;
      } catch {
        return false;
      }
    }
    return !!config.apiKey;
  }

  /** Generic chat completion call (OpenAI-compatible format) */
  private async chat(messages: ChatMessage[]): Promise<string> {
    const config = this.getConfig();

    // Anthropic uses a different API format
    if (config.provider === "anthropic") {
      return this.chatAnthropic(messages, config);
    }

    // All other providers use OpenAI-compatible format
    // Ollama supports this at /v1/chat/completions
    const url =
      config.provider === "ollama"
        ? `${config.endpoint}/v1/chat/completions`
        : `${config.endpoint}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const body = JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: 0.3,
    });

    const response = await Zotero.HTTP.request("POST", url, {
      headers,
      body,
      responseType: "json",
      timeout: 60000,
    });

    const data =
      typeof response.response === "string"
        ? JSON.parse(response.response)
        : response.response;

    return (
      data.choices?.[0]?.message?.content?.trim() ||
      "Unable to generate summary."
    );
  }

  /** Anthropic Messages API (different format from OpenAI) */
  private async chatAnthropic(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");

    const body = JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemMsg?.content || "",
      messages: userMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const response = await Zotero.HTTP.request(
      "POST",
      `${config.endpoint}/messages`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
        responseType: "json",
        timeout: 60000,
      },
    );

    const data =
      typeof response.response === "string"
        ? JSON.parse(response.response)
        : response.response;

    return (
      data.content?.[0]?.text?.trim() || "Unable to generate summary."
    );
  }
}

// --- Summary storage helpers ---

const SUMMARY_TAG = "ResearchHub Summary";

/** Store summary as a child note on the item */
export async function storeSummary(
  item: Zotero.Item,
  summary: string,
): Promise<void> {
  const noteIDs = item.getNotes();
  for (const noteID of noteIDs) {
    const note = Zotero.Items.get(noteID);
    if (note && note.hasTag(SUMMARY_TAG)) {
      note.setNote(
        `<p><strong>ResearchHub Summary:</strong></p><p>${escapeHtml(summary)}</p>`,
      );
      await note.saveTx();
      return;
    }
  }

  // Create new child note
  const note = new Zotero.Item("note");
  note.parentID = item.id;
  note.setNote(
    `<p><strong>ResearchHub Summary:</strong></p><p>${escapeHtml(summary)}</p>`,
  );
  note.addTag(SUMMARY_TAG);
  await note.saveTx();
}

/** Retrieve stored summary from child note */
export function getStoredSummary(item: Zotero.Item): string | null {
  const noteIDs = item.getNotes();
  for (const noteID of noteIDs) {
    const note = Zotero.Items.get(noteID);
    if (note && note.hasTag(SUMMARY_TAG)) {
      const html = note.getNote();
      // Strip HTML tags to get plain text
      const text = html.replace(/<[^>]*>/g, "");
      return text.replace("ResearchHub Summary:", "").trim() || null;
    }
  }
  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
