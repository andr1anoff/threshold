/**
 * THRESHOLD — logo mark.
 *
 * Three tiles ascending left-to-right. The top one — the tread not yet stepped
 * on — carries the crimson. Nothing else. Two colours, three rectangles.
 *
 * No echo, no gradient, no filter. The mark is legible at 16px because there is
 * nothing in it that can smear, and it inverts cleanly because both colours are
 * theme variables.
 *
 * Geometry is mirrored exactly in public/favicon.svg. Change one, change both.
 *
 * Grid: 32×32. Tile 10×4. Run 8, rise 6 — an even climb.
 * Bounding box is 26×16, so margins are 3/3 horizontally and 8/8 vertically:
 * the mark sits dead centre. Keep it that way if you touch the coordinates.
 */

const TILES = [
  [3, 20],   // bottom — ink
  [11, 14],  // middle — ink
  [19, 8],   // top    — crimson, the threshold ahead
];

const TW = 10;
const TH = 4;

export default function Logo({ size = 28, white = false }) {
  // --ink flips to bone in dark mode; --logo-acc brightens to #B2485C.
  const ink = white ? "#fff" : "var(--ink)";
  const acc = white ? "#C4485C" : "var(--logo-acc, var(--crimson))";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      {TILES.map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={TW}
          height={TH}
          fill={i === 2 ? acc : ink}
        />
      ))}
    </svg>
  );
}
