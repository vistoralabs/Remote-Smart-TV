import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ir/profiles" as any)({
  loader: () => ({
    status: "ok",
    cloudProfilesCount: 0,
    profiles: [],
  }),
});
