import { getServerEnvVariables } from "./env";
import { TransmissionResponse } from "../types";

function normalizeUrl(url?: string) {
  if (!url) return undefined;
  return url.replace(/\/$/, "");
}

export async function addTorrent(
  torrentUrl: string,
  category: "audiobook" | "ebook",
): Promise<TransmissionResponse> {
  try {
    const {
      QBITTORRENT_URL,
      QBITTORRENT_USERNAME,
      QBITTORRENT_PASSWORD,
      AUDIOBOOK_DESTINATION_PATH,
      EBOOK_DESTINATION_PATH,
    } = getServerEnvVariables();

    if (!QBITTORRENT_URL) {
      throw new Error("QBITTORRENT_URL is not configured");
    }

    const downloadDir =
      category === "audiobook" ? AUDIOBOOK_DESTINATION_PATH : EBOOK_DESTINATION_PATH;

    const base = normalizeUrl(QBITTORRENT_URL);

    console.log("[qBittorrent] Starting torrent add:", {
      url: base,
      category,
      downloadDir,
      hasCredentials: !!(QBITTORRENT_USERNAME && QBITTORRENT_PASSWORD),
    });

    // Attempt to login if credentials provided
    let cookie: string | undefined;
    if (QBITTORRENT_USERNAME && QBITTORRENT_PASSWORD) {
      console.log("[qBittorrent] Attempting login...");
      const loginResp = await fetch(`${base}/api/v2/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: QBITTORRENT_USERNAME,
          password: QBITTORRENT_PASSWORD,
        }),
      });

      console.log("[qBittorrent] Login response status:", loginResp.status);

      if (!loginResp.ok) {
        throw new Error(`qBittorrent auth failed: ${loginResp.status}`);
      }

      // Try to capture cookie from response headers (server environment)
      const setCookie = loginResp.headers.get("set-cookie");
      if (setCookie) {
        cookie = setCookie.split(";")[0];
        console.log("[qBittorrent] Cookie acquired");
      }
    }

    let addResp: Response;

    // For simple torrent URLs or magnet links, send URL-encoded body
    // to avoid multipart/form-data boundaries appearing in server logs.
    if (/^magnet:|^https?:\/\//i.test(torrentUrl)) {
      console.log("[qBittorrent] Adding torrent via URL/magnet link");
      const params = new URLSearchParams();
      params.append("urls", torrentUrl);
      if (downloadDir) params.append("savepath", downloadDir);

      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
      };
      if (cookie) headers["Cookie"] = cookie;

      console.log("[qBittorrent] Request URL:", `${base}/api/v2/torrents/add`);
      console.log("[qBittorrent] Request params:", {
        urls: torrentUrl.substring(0, 100) + (torrentUrl.length > 100 ? "..." : ""),
      });

      addResp = await fetch(`${base}/api/v2/torrents/add`, {
        method: "POST",
        headers,
        body: params.toString(),
      });
    } else {
      console.log("[qBittorrent] Adding torrent via file upload");
      const form = new FormData();
      form.append("urls", torrentUrl);
      if (downloadDir) form.append("savepath", downloadDir);

      addResp = await fetch(`${base}/api/v2/torrents/add`, {
        method: "POST",
        body: form as any,
        headers: cookie ? { Cookie: cookie } : undefined,
      });
    }

    console.log("[qBittorrent] Add torrent response status:", addResp.status);

    if (!addResp.ok) {
      const text = await addResp.text();
      console.error("[qBittorrent] Add torrent failed response body:", text);
      throw new Error(`qBittorrent add torrent failed: ${addResp.status} ${text}`);
    }

    console.log("[qBittorrent] Torrent added successfully");

    return {
      success: true,
      message: "Torrent added successfully",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[qBittorrent] Error adding torrent:", errorMsg);
    console.error("[qBittorrent] Full error:", error);
    return {
      success: false,
      message: "Failed to add torrent",
      error: errorMsg,
    };
  }
}

export default { addTorrent };
