/** Destination & venue photos in /public/photos; `photoFor` picks one for an event. */
export type PhotoKey =
  | "udaipur" | "mumbai" | "goa" | "jaipur" | "hyderabad" | "shimla" | "bengaluru"
  | "wedding" | "wedding-arch" | "conference" | "keynote" | "lobby" | "room" | "resort" | "chandelier";

export const PHOTO_ALT: Record<PhotoKey, string> = {
  udaipur: "The City Palace on the banks of Lake Pichola, Udaipur",
  mumbai: "The Gateway of India and Taj Mahal Palace hotel, Mumbai",
  goa: "Beach huts and palm trees on a Goa shoreline",
  jaipur: "Hawa Mahal, Jaipur",
  hyderabad: "Charminar, Hyderabad",
  shimla: "Shimla town on the Himalayan foothills",
  bengaluru: "Bengaluru skyline at night",
  wedding: "Couple under a floral mandap at an Indian wedding",
  "wedding-arch": "Decorated wedding aisle with floral arch",
  conference: "Audience seated in a conference hall",
  keynote: "Speaker addressing a large audience on stage",
  lobby: "Modern hotel lobby with lounge seating",
  room: "Hotel room with white bed linen",
  resort: "Resort pool lined with palm trees",
  chandelier: "Chandelier in a hotel ballroom",
};

const CITY: [RegExp, PhotoKey][] = [
  [/udaipur/i, "udaipur"],
  [/mumbai|bombay/i, "mumbai"],
  [/goa|benaulim|calangute|panaji/i, "goa"],
  [/jaipur/i, "jaipur"],
  [/hyderabad/i, "hyderabad"],
  [/shimla|himachal|manali/i, "shimla"],
  [/bengaluru|bangalore/i, "bengaluru"],
];

const TYPE: Record<string, PhotoKey> = {
  wedding: "wedding",
  mice: "conference",
  conference: "keynote",
  corporate: "lobby",
  social: "resort",
};

export function photoFor(event: { location?: string | null; venue?: string | null; type?: string | null }): { src: string; alt: string } {
  const hay = `${event.location ?? ""} ${event.venue ?? ""}`;
  const key = CITY.find(([re]) => re.test(hay))?.[1] ?? TYPE[event.type ?? ""] ?? "lobby";
  return { src: `/photos/${key}.webp`, alt: PHOTO_ALT[key] };
}

export function photo(key: PhotoKey) {
  return { src: `/photos/${key}.webp`, alt: PHOTO_ALT[key] };
}
