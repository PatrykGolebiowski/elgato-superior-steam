export interface CompositeOptions {
  grayscale?: boolean;
}

// Stream Deck key icon size
const ICON_SIZE = 144;

/**
 * Composites an app icon with an optional grayscale filter.
 * Returns a base64 data URI of the final SVG.
 */
export function compositeAppIcon(
  iconBase64: string,
  options: CompositeOptions = {},
): string {
  const { grayscale = false } = options;

  let filterDefs = "";
  let imageFilter = "";

  if (grayscale) {
    filterDefs = `
    <filter id="grayscale">
      <feColorMatrix type="saturate" values="0"/>
    </filter>`;
    imageFilter = 'filter="url(#grayscale)"';
  }

  const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}">
  <defs>${filterDefs}
  </defs>
  <image href="${iconBase64}" width="${ICON_SIZE}" height="${ICON_SIZE}" ${imageFilter}/>
</svg>`;

  const base64 = Buffer.from(compositeSvg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
