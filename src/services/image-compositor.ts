export type BadgeType = "update" | "running" | "downloading";

export type BadgePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface CompositeOptions {
  grayscale?: boolean;
  badge?: BadgeType;
  badgePosition?: BadgePosition;
}

// Stream Deck key icon size
const ICON_SIZE = 144;
const BADGE_SIZE = 48;
const BADGE_PADDING = 4;

// Badge SVG content (viewBox 0 0 24 24)
const BADGE_SVG_CONTENT: Record<BadgeType, string> = {
  update: `<path d="M5.07,8A8,8,0,0,1,20,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><path d="M18.93,16A8,8,0,0,1,4,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><polyline points="5 3 5 8 10 8" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline><polyline points="19 21 19 16 14 16" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline>`,
  running: `<polygon points="5,3 19,12 5,21" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"/>`,
  downloading: `<path d="M12,3 L12,15 M12,15 L7,10 M12,15 L17,10" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"/><path d="M5,21 L19,21" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"/>`,
};

/**
 * Computes badge position coordinates
 */
function getBadgeCoordinates(position: BadgePosition): {
  x: number;
  y: number;
} {
  switch (position) {
    case "top-left":
      return { x: BADGE_PADDING, y: BADGE_PADDING };
    case "top-right":
      return { x: ICON_SIZE - BADGE_SIZE - BADGE_PADDING, y: BADGE_PADDING };
    case "bottom-left":
      return { x: BADGE_PADDING, y: ICON_SIZE - BADGE_SIZE - BADGE_PADDING };
    case "bottom-right":
    default:
      return {
        x: ICON_SIZE - BADGE_SIZE - BADGE_PADDING,
        y: ICON_SIZE - BADGE_SIZE - BADGE_PADDING,
      };
  }
}

/**
 * Composites an app icon with optional grayscale filter and badge overlay.
 * Returns a base64 data URI of the final SVG.
 */
export function compositeAppIcon(
  iconBase64: string,
  options: CompositeOptions = {},
): string {
  const { grayscale = false, badge, badgePosition = "bottom-right" } = options;

  // Build filter definitions
  let filterDefs = "";
  let imageFilter = "";

  if (grayscale) {
    filterDefs = `
    <filter id="grayscale">
      <feColorMatrix type="saturate" values="0"/>
    </filter>`;
    imageFilter = 'filter="url(#grayscale)"';
  }

  // Build badge element
  let badgeElement = "";

  if (badge) {
    const badgeContent = BADGE_SVG_CONTENT[badge];
    const { x, y } = getBadgeCoordinates(badgePosition);

    // Scale the badge from its viewBox (24x24) to BADGE_SIZE
    const scale = BADGE_SIZE / 24;

    badgeElement = `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      ${badgeContent}
    </g>`;
  }

  // Compose final SVG
  const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}">
  <defs>${filterDefs}
  </defs>
  <image href="${iconBase64}" width="${ICON_SIZE}" height="${ICON_SIZE}" ${imageFilter}/>
  ${badgeElement}
</svg>`;

  // Convert to base64 data URI
  const base64 = Buffer.from(compositeSvg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Determines composite options based on Steam app state flags
 */
export function getCompositeOptionsFromStateFlags(
  stateFlags: number,
): CompositeOptions | null {
  // Check states in priority order

  if (stateFlags & SteamStateFlags.AppRunning) {
    return { badge: "running" };
  }

  const updateInProgressFlags =
    SteamStateFlags.UpdateRunning |
    SteamStateFlags.UpdateStarted |
    SteamStateFlags.Downloading |
    SteamStateFlags.Staging |
    SteamStateFlags.Committing;

  if (stateFlags & updateInProgressFlags) {
    return { badge: "downloading" };
  }

  if (stateFlags & SteamStateFlags.UpdateRequired) {
    return { grayscale: true, badge: "update" };
  }

  // Fully installed, no special treatment
  return null;
}
