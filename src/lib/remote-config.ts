/**
 * Centralized RemoteConfigManager.
 *
 * Fetches configuration from Cloudflare Worker (/api/config) with safe local
 * defaults and localStorage caching so the app NEVER crashes if Cloudflare is offline.
 */

export interface AppAnnouncementConfig {
  enabled: boolean;
  title: string;
  message: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface RatingConfig {
  enabled: boolean;
  delaySeconds: number;
  cooldownHours: number;
}

export interface FeatureFlagsConfig {
  androidTv: boolean;
  bluetooth: boolean;
  ir: boolean;
  soundbar: boolean;
  ac: boolean;
  fan: boolean;
  ads: boolean;
  rating: boolean;
}

export interface AdsConfigData {
  enabled: boolean;
  banner: boolean;
  interstitial: boolean;
  appOpen: boolean;
}

export interface VersionConfig {
  minimumSupported: string;
  recommended: string;
  message: string;
  updateUrl: string;
}

export interface RemoteConfig {
  appAnnouncement: AppAnnouncementConfig;
  rating: RatingConfig;
  features: FeatureFlagsConfig;
  ads: AdsConfigData;
  version: VersionConfig;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  appAnnouncement: {
    enabled: false,
    title: "",
    message: "",
    imageUrl: "",
    buttonText: "",
    buttonUrl: "",
  },
  rating: {
    enabled: true,
    delaySeconds: 10,
    cooldownHours: 2160, // 90 days
  },
  features: {
    androidTv: true,
    bluetooth: true,
    ir: true,
    soundbar: true,
    ac: true,
    fan: true,
    ads: true,
    rating: true,
  },
  ads: {
    enabled: true,
    banner: true,
    interstitial: true,
    appOpen: true,
  },
  version: {
    minimumSupported: "1.0.0",
    recommended: "4.1.0",
    message: "A new version of Smart TV Remote is available with improved device support.",
    updateUrl: "https://play.google.com/store/apps/details?id=app.remote.universal",
  },
};

const CONFIG_CACHE_KEY = "remoteConfig.cached.v1";

function readCachedConfig(): RemoteConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return DEFAULT_REMOTE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<RemoteConfig>;
    return {
      appAnnouncement: { ...DEFAULT_REMOTE_CONFIG.appAnnouncement, ...parsed.appAnnouncement },
      rating: { ...DEFAULT_REMOTE_CONFIG.rating, ...parsed.rating },
      features: { ...DEFAULT_REMOTE_CONFIG.features, ...parsed.features },
      ads: { ...DEFAULT_REMOTE_CONFIG.ads, ...parsed.ads },
      version: { ...DEFAULT_REMOTE_CONFIG.version, ...parsed.version },
    };
  } catch {
    return DEFAULT_REMOTE_CONFIG;
  }
}

function cacheConfig(config: RemoteConfig): void {
  try {
    window.localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    /* storage unavailable */
  }
}

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  const cached = readCachedConfig();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("/api/config", { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return cached;
    const data = (await response.json()) as Partial<RemoteConfig>;
    const merged: RemoteConfig = {
      appAnnouncement: { ...cached.appAnnouncement, ...data.appAnnouncement },
      rating: { ...cached.rating, ...data.rating },
      features: { ...cached.features, ...data.features },
      ads: { ...cached.ads, ...data.ads },
      version: { ...cached.version, ...data.version },
    };
    cacheConfig(merged);
    return merged;
  } catch {
    return cached;
  }
}
