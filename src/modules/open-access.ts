import { getPref } from "../utils/prefs";

export interface OAStatus {
  isOpenAccess: boolean;
  oaLocation?: string;
  oaVersion?: string;
  checkedAt: number;
}

export class OpenAccessChecker {
  public cache: Map<string, OAStatus> = new Map();

  /** Check OA status for a single item via its DOI */
  async checkItem(item: Zotero.Item): Promise<OAStatus> {
    const doi = item.getField("DOI") as string;
    if (!doi) {
      return { isOpenAccess: false, checkedAt: Date.now() };
    }

    // Check cache first
    const cached = this.getCached(doi);
    if (cached) return cached;

    // Query Unpaywall API
    const email = getPref("oa.email");
    if (!email) {
      return this.checkLocalPDF(item);
    }

    try {
      const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
      const response = await Zotero.HTTP.request("GET", url, {
        responseType: "json",
        timeout: 10000,
      });

      const data =
        typeof response.response === "string"
          ? JSON.parse(response.response)
          : response.response;

      const status: OAStatus = {
        isOpenAccess: data.is_oa === true,
        oaLocation:
          data.best_oa_location?.url_for_pdf || data.best_oa_location?.url,
        oaVersion: data.best_oa_location?.version,
        checkedAt: Date.now(),
      };

      this.cache.set(doi, status);
      return status;
    } catch (e) {
      ztoolkit.log(`Unpaywall API error for ${doi}: ${e}`);
      return this.checkLocalPDF(item);
    }
  }

  /** Batch check OA status for multiple items */
  async checkItems(
    items: Zotero.Item[],
  ): Promise<Map<number, OAStatus>> {
    const results = new Map<number, OAStatus>();
    for (const item of items) {
      results.set(item.id, await this.checkItem(item));
      // Rate limit: 100ms between requests to be polite
      await Zotero.Promise.delay(100);
    }
    return results;
  }

  /** Fallback: check if item already has a PDF attachment */
  private checkLocalPDF(item: Zotero.Item): OAStatus {
    const attachmentIDs = item.getAttachments();
    const hasPDF = attachmentIDs.some((id: number) => {
      const att = Zotero.Items.get(id);
      return att && att.attachmentContentType === "application/pdf";
    });
    return {
      isOpenAccess: hasPDF,
      checkedAt: Date.now(),
    };
  }

  private getCached(doi: string): OAStatus | null {
    const cached = this.cache.get(doi);
    if (!cached) return null;
    const cacheDays = getPref("oa.cacheDays") || 30;
    const maxAge = cacheDays * 24 * 60 * 60 * 1000;
    if (Date.now() - cached.checkedAt > maxAge) {
      this.cache.delete(doi);
      return null;
    }
    return cached;
  }
}
