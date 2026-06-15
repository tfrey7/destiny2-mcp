import type { RemainingTriumph, TitleView } from "../../bungie/progression.js";

/** A title's standing as the gallery renders it — drives the tile's crest treatment and accent. */
export type TitleStatus = "earned" | "in_progress" | "not_started";

/**
 * One seal in the Titles gallery — the reduced, display-ready shape both renderers consume. The
 * `title` word is the hero element (shown in the gold gothic style under a player's name in-game);
 * `name` is the seal's source, and `status` colours the crest. `gilded` (> 0) draws the laurel
 * count, and `requirement` backs the hover panel's unlock line.
 */
export interface TitleTile {
  sealHash: number;
  /** The earned title word ("Rivensbane") — the tile's marquee. */
  title: string;
  /** The seal's source ("Last Wish") — the smaller label under the title. */
  name: string;
  status: TitleStatus;
  complete: number;
  total: number;
  percent: number;
  gildable: boolean;
  gilded: number;
  requirement?: string;
  /** The seal's still-incomplete Triumphs (closest-to-done first) — the hover's "what's left" list. */
  remaining: RemainingTriumph[];
  /** Relative Bungie CDN icon path; the grid inlines it as a data: URI (see images.ts). */
  icon?: string;
}

/** What the tool hands the model layer: the gallery's titles plus the header strings. */
export interface TitleCard {
  /** Header line — "Titles". */
  title: string;
  /** Sub-line — "3 of 42 earned · 13,865 Triumph score". */
  subtitle: string;
  titles: TitleView[];
}

/** The shared shape every Titles-card renderer (text, html, images) reads. */
export interface TitleCardModel {
  title: string;
  subtitle: string;
  tiles: TitleTile[];
}

/**
 * Reduce the enriched titles to ordered, display-ready tiles — the shared input for the text card
 * and the interactive gallery alike. Order is preserved (titleGallery already sorts earned-first,
 * then closest-to-done), and each title's earned/percent collapses to a single status the renderers
 * style on.
 *
 * @example
 * {
 *   title: "Titles",
 *   subtitle: "3 of 42 earned · 13,865 Triumph score",
 *   tiles: [
 *     { title: "Vidmaster", name: "30th Anniversary", status: "earned",
 *       complete: 10, total: 10, percent: 100, gildable: false, gilded: 0 },
 *   ],
 * }
 */
export function titleCardModel(card: TitleCard): TitleCardModel {
  return {
    title: card.title,
    subtitle: card.subtitle,
    tiles: card.titles.map(tile),
  };
}

function tile(view: TitleView): TitleTile {
  return {
    sealHash: view.sealHash,
    title: view.title,
    name: view.name,
    status: status(view),
    complete: view.complete,
    total: view.total,
    percent: view.percent,
    gildable: view.gildable,
    gilded: view.gilded,
    ...(view.requirement ? { requirement: view.requirement } : {}),
    remaining: view.remaining,
    ...(view.icon ? { icon: view.icon } : {}),
  };
}

// Earned trumps progress; an untouched seal (no Triumphs done) reads as not-started so the gallery
// can dim it the way the in-game screen greys titles you haven't begun.
function status(view: TitleView): TitleStatus {
  if (view.earned) {
    return "earned";
  }

  return view.complete > 0 ? "in_progress" : "not_started";
}
