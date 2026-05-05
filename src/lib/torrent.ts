import { addTorrent as addTransmission } from "./transmission-api";
import { addTorrent as addQBittorrent } from "./qbittorrent-api";
import { getServerEnvVariables } from "./env";
import { TransmissionResponse } from "../types";

export async function addTorrent(
  torrentUrl: string,
  category: "audiobook" | "ebook",
): Promise<TransmissionResponse> {
  const { TORRENT_API } = getServerEnvVariables();
  const api = (TORRENT_API || "transmission").toLowerCase();

  if (api === "qbittorrent") {
    return addQBittorrent(torrentUrl, category);
  }

  return addTransmission(torrentUrl, category);
}

export default { addTorrent };
