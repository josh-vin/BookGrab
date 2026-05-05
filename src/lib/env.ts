import { readFileSync } from "fs";

export const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnvVariable = (key: string): string | undefined => {
  return process.env[key];
};

const getMamToken = (): string | undefined => {
  const token = getOptionalEnvVariable("MAM_TOKEN");
  if (token) return token;

  const filePath = getOptionalEnvVariable("MAM_TOKEN_FILE");
  if (filePath) {
    try {
      return readFileSync(filePath, "utf-8").trim();
    } catch {
      console.error(`Failed to read MAM token from file: ${filePath}`);
    }
  }

  return undefined;
};

export const getServerEnvVariables = () => {
  return {
    MAM_TOKEN: getMamToken(),
    // Which torrent backend to use. Possible values: 'transmission' | 'qbittorrent'. Optional, defaults to 'transmission'
    TORRENT_API: getOptionalEnvVariable("TORRENT_API"),

    // Transmission settings (optional if using qBittorrent)
    TRANSMISSION_URL: getOptionalEnvVariable("TRANSMISSION_URL"),

    // qBittorrent settings (optional if using Transmission)
    QBITTORRENT_URL: getOptionalEnvVariable("QBITTORRENT_URL"),
    QBITTORRENT_USERNAME: getOptionalEnvVariable("QBITTORRENT_USERNAME"),
    QBITTORRENT_PASSWORD: getOptionalEnvVariable("QBITTORRENT_PASSWORD"),

    AUDIOBOOK_DESTINATION_PATH: getEnvVariable("AUDIOBOOK_DESTINATION_PATH"),
    EBOOK_DESTINATION_PATH: getEnvVariable("EBOOK_DESTINATION_PATH"),
  };
};
