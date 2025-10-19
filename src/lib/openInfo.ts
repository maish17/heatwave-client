// src/lib/openInfo.ts
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

function devInfoUrl() {
  if (Capacitor.getPlatform() === "android") return "http://10.0.2.2:5173/info";
  return `${window.location.origin}/info`;
}

export const INFO_URL = import.meta.env.PROD
  ? "https://heatwaves.app/info"
  : devInfoUrl();

export async function openInfo() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: INFO_URL });
    } else {
      window.open(INFO_URL, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.location.href = INFO_URL;
  }
}
