export type Transport = "wifi" | "bluetooth" | "ir";

export type Brand =
  | "roku"
  | "samsung"
  | "lg"
  | "sony"
  | "androidtv"
  | "firetv"
  | "vizio"
  | "hisense"
  | "tcl"
  | "generic";

export interface Device {
  id: string;
  name: string;
  brand: Brand;
  transport: Transport;
  /** LAN address for wifi devices, BLE device id for bluetooth, empty for IR */
  address: string;
}

export type Key =
  | "power"
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "home"
  | "menu"
  | "volup"
  | "voldown"
  | "mute"
  | "chup"
  | "chdown"
  | "input"
  | "play"
  | "pause"
  | "rewind"
  | "forward"
  | "info"
  | "guide"
  | "exit"
  | "keyboard"
  | "backspace"
  | "enter"
  | "voice";

export const BRANDS: { value: Brand; label: string }[] = [
  { value: "roku", label: "Roku / TCL Roku TV" },
  { value: "samsung", label: "Samsung" },
  { value: "lg", label: "LG webOS" },
  { value: "sony", label: "Sony Bravia" },
  { value: "androidtv", label: "Android TV / Google TV" },
  { value: "firetv", label: "Amazon Fire TV" },
  { value: "vizio", label: "Vizio SmartCast" },
  { value: "hisense", label: "Hisense" },
  { value: "tcl", label: "TCL" },
  { value: "generic", label: "Other / Generic" },
];

export const TRANSPORT_LABEL: Record<Transport, string> = {
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  ir: "IR Blaster",
};

/** Roku ECP key names — the only protocol we can drive straight from a browser. */
export const ROKU_KEYMAP: Partial<Record<Key, string>> = {
  power: "Power",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  ok: "Select",
  back: "Back",
  home: "Home",
  menu: "Info",
  volup: "VolumeUp",
  voldown: "VolumeDown",
  mute: "VolumeMute",
  chup: "ChannelUp",
  chdown: "ChannelDown",
  input: "InputHDMI1",
  play: "Play",
  pause: "Play",
  rewind: "Rev",
  forward: "Fwd",
  info: "Info",
  guide: "Info",
  exit: "Home",
};
