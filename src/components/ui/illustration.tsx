/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Spot illustrations (CC0) from /public/illustrations. */
export const ILLUSTRATIONS = {
  abacus: "Abacus",
  bed: "Bed",
  bedroom: "Bedroom",
  blackboard: "Blackboard",
  building: "Building",
  cafe: "Cafe",
  calculator: "Calculator",
  camping: "Camping",
  champagne: "Champagne",
  "city-road": "City road",
  coffee: "Coffee",
  desktop: "Desktop",
  "dotted-notebook": "Dotted notebook",
  "e-scooter": "E-scooter",
  "experiment-lab": "Experiment lab",
  firework: "Firework",
  followers: "Followers",
  forklift: "Forklift",
  freelancing: "Freelancing",
  "it-girl": "IT girl",
  lantern: "Lantern",
  "living-room": "Living room",
  "office-bag": "Office bag",
  "open-vault": "Open vault",
  owl: "Owl",
  "pirate-boat": "Pirate boat",
  polaroid: "Polaroid",
  printer: "Printer",
  programming: "Programming",
  rainbow: "Rainbow",
  robot: "Robot",
  rocket: "Rocket",
  snail: "Snail",
  "sweet-home": "Sweet home",
  ticket: "Ticket",
  toolbox: "Toolbox",
  "travel-bag": "Travel bag",
  travel: "Travel",
  "ui-ux": "UI / UX",
  vault: "Vault",
  "vintage-camera": "Vintage camera",
  "walkie-talkie": "Walkie talkie",
  wallet: "Wallet",
  "writing-tool": "Writing tool",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

interface IllustrationProps {
  name: IllustrationName;
  className?: string;
  /** Decorative by default; pass alt text when the image carries meaning. */
  alt?: string;
  priority?: boolean;
}

export function Illustration({ name, className, alt = "", priority }: IllustrationProps) {
  return (
    <img
      src={`/illustrations/${name}.svg`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={cn("ill-art", className)}
    />
  );
}
