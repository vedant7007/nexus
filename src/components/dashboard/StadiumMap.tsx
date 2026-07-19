'use client';

// A schematic, not a map and not a game: eight arcs around a pitch, tinted by
// density. Its job is to answer "where?" in one glance, which a table of eight
// percentages cannot do. It is inline SVG with no library, so it costs nothing
// on the critical path.
import { Panel } from '@/components/ui/Panel';
import type { ZoneStateDto } from '@/lib/ui/dto';
import { densityBand, statusOf } from '@/lib/ui/status';

export interface StadiumMapProps {
  zones: readonly ZoneStateDto[];
}

/** Geometry for one zone block, in SVG user units. */
interface ZoneBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fixed layout of the eight zones around the pitch.
 *
 * Positions are static because the venue is static; deriving them would be
 * cleverness with no payoff.
 */
const BLOCKS: readonly ZoneBlock[] = [
  { id: 'z1', x: 60, y: 8, width: 80, height: 26 }, // North Lower
  { id: 'z2', x: 60, y: 36, width: 80, height: 18 }, // North Upper
  { id: 'z3', x: 148, y: 40, width: 26, height: 60 }, // East Concourse
  { id: 'z4', x: 176, y: 40, width: 18, height: 60 }, // East Stand
  { id: 'z5', x: 60, y: 106, width: 80, height: 26 }, // South Lower
  { id: 'z6', x: 60, y: 86, width: 80, height: 18 }, // South Upper — inner ring
  { id: 'z7', x: 26, y: 40, width: 26, height: 60 }, // West Concourse
  { id: 'z8', x: 6, y: 40, width: 18, height: 60 }, // West Stand
];

/**
 * A schematic of the venue, tinted by zone density.
 *
 * The SVG is `aria-hidden` and the accessible information lives in the
 * visually-hidden list beneath it. Duplicating eight zones into SVG `<title>`
 * elements would make a screen reader announce the same figures twice — the
 * zone grid already states them, so here the graphic is decoration over a
 * text equivalent.
 */
export function StadiumMap({ zones }: StadiumMapProps) {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));

  return (
    <Panel title="Venue Schematic">
      <svg
        viewBox="0 0 200 140"
        className="h-auto w-full"
        role="img"
        aria-label="Schematic of the venue showing crowd density by zone. The same figures are listed in the zones and gates panel."
      >
        <rect x="0" y="0" width="200" height="140" fill="var(--color-void)" rx="4" />

        {BLOCKS.map((block) => {
          const zone = byId.get(block.id);
          const level = densityBand(zone?.densityPct ?? 0);
          const status = statusOf(level);

          return (
            <rect
              key={block.id}
              x={block.x}
              y={block.y}
              width={block.width}
              height={block.height}
              rx="2"
              className="transition-opacity duration-500"
              // A Tailwind bg-* class does nothing to an SVG fill, so the colour
              // is applied directly. Opacity scales with density so a filling
              // zone visibly deepens toward its status colour.
              fill={status.color}
              opacity={zone === undefined ? 0.2 : 0.45 + Math.min(zone.densityPct, 100) / 180}
            />
          );
        })}

        {/* The pitch, for orientation only. */}
        <rect
          x="58"
          y="56"
          width="84"
          height="28"
          rx="1"
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        <line
          x1="100"
          y1="56"
          x2="100"
          y2="84"
          stroke="var(--color-border-strong)"
          strokeWidth="0.5"
        />
      </svg>

      <ul className="sr-only">
        {zones.map((zone) => (
          <li key={zone.id}>
            {zone.name}: {Math.round(zone.densityPct)} percent of safe capacity,{' '}
            {statusOf(densityBand(zone.densityPct)).announcement}.
          </li>
        ))}
      </ul>
    </Panel>
  );
}
