import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { DEFAULT_REMOTE_CONFIG, type RemoteConfig } from "./lib/remote-config";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface EnvBindings {
  REMOTE_CONFIG_KV?: KVNamespace;
  CONFIG_KV?: KVNamespace;
  REMOTE_CONFIG?: KVNamespace;
  ADMIN_SECRET?: string;
}

const KV_CONFIG_KEY = "remote-config:v1";

// Active live test config state (used as live Cloudflare dynamic default when KV is not bound)
let inMemoryDynamicConfig: RemoteConfig = {
  ...DEFAULT_REMOTE_CONFIG,
  appAnnouncement: {
    enabled: true,
    title: "🎉 VISTORA LABS TEST",
    message: "Cloudflare Remote Config is working.",
    imageUrl: "",
    buttonText: "Open App",
    buttonUrl: "https://play.google.com/store/apps/details?id=app.remote.universal",
  },
};

function getKvBinding(env: unknown): KVNamespace | null {
  if (!env || typeof env !== "object") return null;
  const e = env as EnvBindings;
  return e.REMOTE_CONFIG_KV ?? e.CONFIG_KV ?? e.REMOTE_CONFIG ?? null;
}

function getAdminSecret(env: unknown): string {
  if (env && typeof env === "object") {
    const e = env as EnvBindings;
    if (e.ADMIN_SECRET && e.ADMIN_SECRET.trim()) return e.ADMIN_SECRET.trim();
  }
  return "vistora-secret-key-2026";
}

function validateAndSanitizeUrl(urlCandidate: unknown, fallback: string): string {
  if (typeof urlCandidate !== "string" || !urlCandidate.trim()) return fallback;
  const str = urlCandidate.trim();
  if (str.startsWith("https://") || str.startsWith("http://") || str.startsWith("/")) {
    return str;
  }
  return fallback;
}

function validateAndSanitizeConfig(input: unknown): RemoteConfig {
  if (!input || typeof input !== "object") return inMemoryDynamicConfig;
  const raw = input as Record<string, Record<string, unknown>>;
  const base = DEFAULT_REMOTE_CONFIG;

  const ann = raw["appAnnouncement"] ?? {};
  const appAnnouncement = {
    enabled: typeof ann["enabled"] === "boolean" ? ann["enabled"] : base.appAnnouncement.enabled,
    title: typeof ann["title"] === "string" ? ann["title"].slice(0, 200) : base.appAnnouncement.title,
    message: typeof ann["message"] === "string" ? ann["message"].slice(0, 1000) : base.appAnnouncement.message,
    imageUrl: validateAndSanitizeUrl(ann["imageUrl"], base.appAnnouncement.imageUrl ?? ""),
    buttonText: typeof ann["buttonText"] === "string" ? ann["buttonText"].slice(0, 50) : base.appAnnouncement.buttonText ?? "",
    buttonUrl: validateAndSanitizeUrl(ann["buttonUrl"], base.appAnnouncement.buttonUrl ?? ""),
  };

  const rat = raw["rating"] ?? {};
  const rating = {
    enabled: typeof rat["enabled"] === "boolean" ? rat["enabled"] : base.rating.enabled,
    delaySeconds: typeof rat["delaySeconds"] === "number" && rat["delaySeconds"] >= 1 && rat["delaySeconds"] <= 300 ? Math.floor(rat["delaySeconds"]) : base.rating.delaySeconds,
    cooldownHours: typeof rat["cooldownHours"] === "number" && rat["cooldownHours"] >= 1 && rat["cooldownHours"] <= 8760 ? Math.floor(rat["cooldownHours"]) : base.rating.cooldownHours,
  };

  const feat = raw["features"] ?? {};
  const features = {
    androidTv: typeof feat["androidTv"] === "boolean" ? feat["androidTv"] : base.features.androidTv,
    bluetooth: typeof feat["bluetooth"] === "boolean" ? feat["bluetooth"] : base.features.bluetooth,
    ir: typeof feat["ir"] === "boolean" ? feat["ir"] : base.features.ir,
    soundbar: typeof feat["soundbar"] === "boolean" ? feat["soundbar"] : base.features.soundbar,
    ac: typeof feat["ac"] === "boolean" ? feat["ac"] : base.features.ac,
    fan: typeof feat["fan"] === "boolean" ? feat["fan"] : base.features.fan,
    ads: typeof feat["ads"] === "boolean" ? feat["ads"] : base.features.ads,
    rating: typeof feat["rating"] === "boolean" ? feat["rating"] : base.features.rating,
  };

  const adsRaw = raw["ads"] ?? {};
  const ads = {
    enabled: typeof adsRaw["enabled"] === "boolean" ? adsRaw["enabled"] : base.ads.enabled,
    banner: typeof adsRaw["banner"] === "boolean" ? adsRaw["banner"] : base.ads.banner,
    interstitial: typeof adsRaw["interstitial"] === "boolean" ? adsRaw["interstitial"] : base.ads.interstitial,
    appOpen: typeof adsRaw["appOpen"] === "boolean" ? adsRaw["appOpen"] : base.ads.appOpen,
  };

  const ver = raw["version"] ?? {};
  const version = {
    minimumSupported: typeof ver["minimumSupported"] === "string" && ver["minimumSupported"].trim() ? ver["minimumSupported"].trim() : base.version.minimumSupported,
    recommended: typeof ver["recommended"] === "string" && ver["recommended"].trim() ? ver["recommended"].trim() : base.version.recommended,
    message: typeof ver["message"] === "string" ? ver["message"].slice(0, 500) : base.version.message,
    updateUrl: validateAndSanitizeUrl(ver["updateUrl"], base.version.updateUrl),
  };

  return { appAnnouncement, rating, features, ads, version };
}

async function loadRemoteConfigFromKv(env: unknown): Promise<RemoteConfig> {
  const kv = getKvBinding(env);
  if (kv) {
    try {
      const raw = await kv.get(KV_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return validateAndSanitizeConfig(parsed);
      }
    } catch {
      /* fall back to dynamic config */
    }
  }
  return inMemoryDynamicConfig;
}

async function saveRemoteConfigToKv(env: unknown, config: RemoteConfig): Promise<boolean> {
  inMemoryDynamicConfig = config;
  const kv = getKvBinding(env);
  if (kv) {
    try {
      await kv.put(KV_CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

function computeEtag(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `W/"${Math.abs(hash).toString(36)}"`;
}

function jsonResponse(body: unknown, request: Request, status = 200): Response {
  const jsonString = JSON.stringify(body);
  const etag = computeEtag(jsonString);

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300",
        etag: etag,
        "access-control-allow-origin": "*",
      },
    });
  }

  return new Response(jsonString, {
    status: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      etag: etag,
      "access-control-allow-origin": "*",
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Public Remote Config Read Endpoints
      if (url.pathname === "/api/config") {
        const config = await loadRemoteConfigFromKv(env);
        return jsonResponse(config, request);
      }

      if (url.pathname === "/api/announcement") {
        const config = await loadRemoteConfigFromKv(env);
        return jsonResponse(config.appAnnouncement, request);
      }

      if (url.pathname === "/api/features") {
        const config = await loadRemoteConfigFromKv(env);
        return jsonResponse(config.features, request);
      }

      if (url.pathname === "/api/version") {
        const config = await loadRemoteConfigFromKv(env);
        return jsonResponse(config.version, request);
      }

      if (url.pathname === "/api/ir/profiles") {
        return jsonResponse({ status: "ok", cloudProfilesCount: 0, profiles: [] }, request);
      }

      // Secure Admin Remote Config Write Endpoints (PUT /admin/config or POST /admin/config)
      if (url.pathname === "/admin/config" && (request.method === "PUT" || request.method === "POST")) {
        const auth = request.headers.get("authorization") ?? request.headers.get("x-admin-secret") ?? "";
        const expectedSecret = getAdminSecret(env);
        const token = auth.replace(/^Bearer\s+/i, "").trim();

        if (token !== expectedSecret) {
          return jsonResponse({ status: "error", message: "Unauthorized admin request" }, request, 401);
        }

        try {
          const body = (await request.json()) as Partial<RemoteConfig>;
          const current = await loadRemoteConfigFromKv(env);
          const mergedToValidate = {
            appAnnouncement: { ...current.appAnnouncement, ...body.appAnnouncement },
            rating: { ...current.rating, ...body.rating },
            features: { ...current.features, ...body.features },
            ads: { ...current.ads, ...body.ads },
            version: { ...current.version, ...body.version },
          };
          const sanitized = validateAndSanitizeConfig(mergedToValidate);
          const savedToKv = await saveRemoteConfigToKv(env, sanitized);

          return jsonResponse(
            {
              status: "ok",
              message: "Remote config updated successfully",
              kvUpdated: savedToKv,
              config: sanitized,
            },
            request,
            200,
          );
        } catch (err) {
          return jsonResponse(
            { status: "error", message: "Invalid JSON body: " + (err instanceof Error ? err.message : String(err)) },
            request,
            400,
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
