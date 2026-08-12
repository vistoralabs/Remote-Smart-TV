import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_REMOTE_CONFIG } from "@/lib/remote-config";

export const Route = createFileRoute("/api/version" as any)({
  loader: () => DEFAULT_REMOTE_CONFIG.version,
});
