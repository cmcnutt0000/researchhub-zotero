import { LLMService, ChatMessage } from "./llm-service";
import { ZotSeekBridge } from "./zotseek-bridge";
import { LinterBridge } from "./linter-bridge";
import { OpenAccessChecker } from "./open-access";

declare const ZoteroPane: any;

interface AgentTool {
  name: string;
  description: string;
  input_schema: any;
  execute: (args: any) => Promise<string>;
}

const SYSTEM_PROMPT = "You are ResearchHub, an AI research assistant integrated into Zotero. You help users manage their academic library by searching papers, summarizing findings, fixing citations, checking open access status, and more. Use the available tools to fulfill user requests. When returning results, be concise and well-organized. Always reference papers by their title.";

export class AgentEngine {
  private tools: AgentTool[];
  private maxIterations: number = 10;

  constructor(
    private llm: LLMService,
    private zotseek: ZotSeekBridge,
    private linter: LinterBridge,
    private oaChecker: OpenAccessChecker
  ) {
    this.tools = [
      {
        name: "search_library",
        description: "Search the Zotero library for papers matching a query string.",
        input_schema: { type: "object", properties: { query: { type: "string", description: "Search query" }, limit: { type: "number", description: "Max results (default 5)" } }, required: ["query"] },
        execute: async (args: any): Promise<string> => {
          const results = await this.zotseek.search(args.query, { limit: args.limit || 5 });
          if (!results || results.length === 0) return "No results found.";
          return results.map((r: any) => "Title: " + r.title + "\nAuthors: " + (r.authors || "Unknown") + "\nYear: " + (r.year || "N/A") + "\nID: " + r.id).join("\n---\n");
        }
      },
      {
        name: "find_similar",
        description: "Find papers similar to a given item in the library.",
        input_schema: { type: "object", properties: { itemId: { type: "number", description: "Zotero item ID" }, limit: { type: "number", description: "Max results (default 5)" } }, required: ["itemId"] },
        execute: async (args: any): Promise<string> => {
          const results = await this.zotseek.findSimilar(args.itemId, { limit: args.limit || 5 });
          if (!results || results.length === 0) return "No similar papers found.";
          return results.map((r: any) => "Title: " + r.title + "\nAuthors: " + (r.authors || "Unknown") + "\nYear: " + (r.year || "N/A") + "\nID: " + r.id).join("\n---\n");
        }
      },
      {
        name: "summarize_paper",
        description: "Generate an AI summary of a specific paper.",
        input_schema: { type: "object", properties: { itemId: { type: "number", description: "Zotero item ID to summarize" } }, required: ["itemId"] },
        execute: async (args: any): Promise<string> => {
          const item = (await Zotero.Items.get(args.itemId)) as any;
          return await this.llm.summarizeAndStore(item);
        }
      },
      {
        name: "fix_citations",
        description: "Lint and fix citation metadata for items.",
        input_schema: { type: "object", properties: { itemIds: { type: "array", items: { type: "number" }, description: "Array of item IDs" } }, required: ["itemIds"] },
        execute: async (args: any): Promise<string> => {
          const items = (await Zotero.Items.get(args.itemIds)) as any;
          const result = await this.linter.fixCitations(Array.isArray(items) ? items : [items]);
          return "Fixed " + (result.fixed || 0) + " items. " + (result.errors || 0) + " errors.";
        }
      },
      {
        name: "check_open_access",
        description: "Check open access availability for items.",
        input_schema: { type: "object", properties: { itemIds: { type: "array", items: { type: "number" }, description: "Array of item IDs" } }, required: ["itemIds"] },
        execute: async (args: any): Promise<string> => {
          const items = (await Zotero.Items.get(args.itemIds)) as any;
          const itemArr: Zotero.Item[] = Array.isArray(items) ? items : [items];
          const resultsMap = await this.oaChecker.checkItems(itemArr);
          const results: any[] = [];
          for (const [id, status] of resultsMap) {
            const it = itemArr.find((x: any) => x.id === id);
            results.push({ title: it ? it.getField("title") : "Unknown", ...status });
          }
          return results.map((r: any) => "Title: " + r.title + "\nOA: " + (r.isOpenAccess ? "Open Access" : "Closed") + (r.oaUrl ? "\nURL: " + r.oaUrl : "")).join("\n---\n");
        }
      },
      {
        name: "get_collection_items",
        description: "Get all items in a named Zotero collection.",
        input_schema: { type: "object", properties: { collectionName: { type: "string", description: "Name of the collection" } }, required: ["collectionName"] },
        execute: async (args: any): Promise<string> => {
          const allCols = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID) as any[];
          const match = allCols.filter((c: any) => c.name.toLowerCase().includes(args.collectionName.toLowerCase()));
          if (match.length === 0) return "No collection matching " + args.collectionName + ".";
          const col = match[0];
          const ids = col.getChildItems(true);
          const items = (await Zotero.Items.get(ids)) as any;
          const itemArr = Array.isArray(items) ? items : (items ? [items] : []);
          if (itemArr.length === 0) return "Collection " + col.name + " is empty.";
          return itemArr.map((it: any) => "Title: " + it.getField("title") + "\nID: " + it.id).join("\n---\n");
        }
      },
      {
        name: "get_selected_items",
        description: "Get the currently selected items in the Zotero UI.",
        input_schema: { type: "object", properties: {}, required: [] },
        execute: async (): Promise<string> => {
          const items = ZoteroPane.getSelectedItems();
          if (!items || items.length === 0) return "No items selected.";
          return items.map((it: any) => "Title: " + it.getField("title") + "\nID: " + it.id).join("\n---\n");
        }
      },
      {
        name: "get_recent_items",
        description: "Get the most recently added items in the library.",
        input_schema: { type: "object", properties: { count: { type: "number", description: "Number of items (default 10)" } }, required: [] },
        execute: async (args: any): Promise<string> => {
          const count = args.count || 10;
          const s = new Zotero.Search();
          s.addCondition("itemType", "isNot", "attachment");
          s.addCondition("itemType", "isNot", "note");
          const ids = await s.search();
          const rawItems = (await Zotero.Items.get(ids)) as any;
          const all: any[] = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
          const sorted = all.sort((a: any, b: any) => b.getField("dateAdded").localeCompare(a.getField("dateAdded"))).slice(0, count);
          if (sorted.length === 0) return "No items found.";
          return sorted.map((it: any) => "Title: " + it.getField("title") + "\nID: " + it.id).join("\n---\n");
        }
      }
    ];
  }

  private getToolByName(name: string): AgentTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  async run(userMessage: string, onUpdate?: (text: string) => void): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];
    const toolDefs = this.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
    const isAnthropic = this.llm.getConfig().provider === "anthropic";

    for (let i = 0; i < this.maxIterations; i++) {
      const data = await this.llm.chatWithTools(messages, toolDefs);

      if (isAnthropic) {
        const toolUseBlocks = (data.content || []).filter((b: any) => b.type === "tool_use");
        if (toolUseBlocks.length === 0) {
          const textBlock = (data.content || []).find((b: any) => b.type === "text");
          return textBlock?.text || "No response generated.";
        }
        messages.push({ role: "assistant", content: data.content });
        const toolResults: any[] = [];
        for (const block of toolUseBlocks) {
          const tool = this.getToolByName(block.name);
          if (!tool) {
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Unknown tool: " + block.name });
            continue;
          }
          if (onUpdate) onUpdate("Running " + block.name + "...");
          try {
            const result = await tool.execute(block.input || {});
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          } catch (err: any) {
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Error: " + err.message });
          }
        }
        messages.push({ role: "user", content: toolResults } as any);
      } else {
        const choice = data.choices?.[0]?.message;
        if (!choice) return "No response generated.";
        const toolCalls = choice.tool_calls;
        if (!toolCalls || toolCalls.length === 0) return choice.content || "No response generated.";
        messages.push({ role: "assistant", content: choice.content || null, tool_calls: toolCalls } as any);
        for (const tc of toolCalls) {
          const fnName = tc.function?.name;
          const fnArgs = JSON.parse(tc.function?.arguments || "{}");
          const tool = this.getToolByName(fnName);
          if (!tool) {
            messages.push({ role: "tool", tool_call_id: tc.id, content: "Unknown tool: " + fnName } as any);
            continue;
          }
          if (onUpdate) onUpdate("Running " + fnName + "...");
          try {
            const result = await tool.execute(fnArgs);
            messages.push({ role: "tool", tool_call_id: tc.id, content: result } as any);
          } catch (err: any) {
            messages.push({ role: "tool", tool_call_id: tc.id, content: "Error: " + err.message } as any);
          }
        }
      }
    }
    return "Reached max iterations (" + this.maxIterations + "). Try a more specific request.";
  }
}

