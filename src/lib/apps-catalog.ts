/** Streaming apps that can be launched on a connected TV. */
export interface StreamApp {
  id: string;
  name: string;
  short: string;
  /** Roku ECP channel id. */
  roku?: string;
  /** Android TV / Fire TV package name. */
  pkg?: string;
  /** Tailwind-safe token pair used for the tile face. */
  hue: string;
}

export const STREAM_APPS: StreamApp[] = [
  {
    id: "netflix",
    name: "Netflix",
    short: "N",
    roku: "12",
    pkg: "com.netflix.ninja",
    hue: "0 72% 51%",
  },
  {
    id: "youtube",
    name: "YouTube",
    short: "YT",
    roku: "837",
    pkg: "com.google.android.youtube.tv",
    hue: "0 78% 52%",
  },
  {
    id: "prime",
    name: "Prime Video",
    short: "PV",
    roku: "13",
    pkg: "com.amazon.amazonvideo.livingroom",
    hue: "199 89% 48%",
  },
  {
    id: "disney",
    name: "Disney+",
    short: "D+",
    roku: "291097",
    pkg: "com.disney.disneyplus",
    hue: "232 66% 45%",
  },
  { id: "hulu", name: "Hulu", short: "H", roku: "2285", pkg: "com.hulu.plus", hue: "150 78% 45%" },
  { id: "max", name: "Max", short: "M", roku: "61322", pkg: "com.hbo.hbonow", hue: "265 70% 55%" },
  {
    id: "paramount",
    name: "Paramount+",
    short: "P+",
    roku: "31440",
    pkg: "com.cbs.ott",
    hue: "215 90% 52%",
  },
  {
    id: "peacock",
    name: "Peacock",
    short: "PC",
    roku: "593099",
    pkg: "com.peacocktv.peacockandroid",
    hue: "20 90% 55%",
  },
  {
    id: "appletv",
    name: "Apple TV+",
    short: "TV",
    roku: "551012",
    pkg: "com.apple.atve.androidtv.appletv",
    hue: "220 8% 45%",
  },
  {
    id: "spotify",
    name: "Spotify",
    short: "S",
    roku: "22297",
    pkg: "com.spotify.tv.android",
    hue: "141 73% 42%",
  },
  {
    id: "plex",
    name: "Plex",
    short: "PX",
    roku: "13535",
    pkg: "com.plexapp.android",
    hue: "42 95% 52%",
  },
  {
    id: "pluto",
    name: "Pluto TV",
    short: "PL",
    roku: "74519",
    pkg: "tv.pluto.android",
    hue: "255 80% 60%",
  },
  { id: "tubi", name: "Tubi", short: "TB", roku: "41468", pkg: "com.tubitv", hue: "268 84% 58%" },
  {
    id: "crunchyroll",
    name: "Crunchyroll",
    short: "CR",
    roku: "2595",
    pkg: "com.crunchyroll.crunchyroid",
    hue: "24 95% 53%",
  },
  {
    id: "espn",
    name: "ESPN",
    short: "ES",
    roku: "34376",
    pkg: "com.espn.score_center",
    hue: "0 0% 25%",
  },
  {
    id: "discovery",
    name: "Discovery+",
    short: "D",
    roku: "305462",
    pkg: "com.discovery.dplus",
    hue: "212 85% 45%",
  },
  {
    id: "youtubetv",
    name: "YouTube TV",
    short: "YTV",
    roku: "195316",
    pkg: "com.google.android.youtube.tvunplugged",
    hue: "0 70% 45%",
  },
  { id: "twitch", name: "Twitch", short: "TW", pkg: "tv.twitch.android.app", hue: "263 75% 58%" },
  {
    id: "sling",
    name: "Sling TV",
    short: "SL",
    roku: "46041",
    pkg: "com.sling",
    hue: "36 96% 52%",
  },
  {
    id: "iptv",
    name: "IPTV Player",
    short: "IP",
    pkg: "ru.iptvremote.android.iptv",
    hue: "186 80% 42%",
  },
  {
    id: "smartiptv",
    name: "Smart IPTV",
    short: "SI",
    pkg: "com.smartiptv.app",
    hue: "160 70% 40%",
  },
  {
    id: "browser",
    name: "Web Browser",
    short: "WB",
    pkg: "com.android.chrome",
    hue: "210 20% 50%",
  },
];
