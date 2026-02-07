import { config } from "../package.json";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import type { Orchestrator } from "./modules/orchestrator";
import type { LinterBridge } from "./modules/linter-bridge";
import type { ZotSeekBridge } from "./modules/zotseek-bridge";
import type { LLMService } from "./modules/llm-service";
import type { OpenAccessChecker } from "./modules/open-access";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    initialized: boolean;
    ztoolkit: ZToolkit;
    locale?: { current: any };
    // Module instances (initialized in hooks.onStartup)
    orchestrator?: Orchestrator;
    linterBridge?: LinterBridge;
    zotseekBridge?: ZotSeekBridge;
    llmService?: LLMService;
    oaChecker?: OpenAccessChecker;
    // State
    notifierID?: string;
    columnDataKey?: string;
  };
  public hooks: typeof hooks;
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
