import { createFileRoute } from "@tanstack/react-router";
import { RemoteApp } from "@/components/remote/RemoteApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart TV Remote Test \u2014 Wi-Fi TV Control" },
      {
        name: "description",
        content:
          "Ad-free smart TV remote with Wi-Fi discovery, secure TV code pairing, D-pad, keyboard and voice control.",
      },
      { property: "og:title", content: "Smart TV Remote \u2014 Wi-Fi TV Control" },
      {
        property: "og:description",
        content:
          "Search your TV, pair it securely over Wi-Fi, then control it from your phone with no ads or tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemoteApp,
});
