import { useStore } from "~/lib/store";

function Arrows() {
  return (
    <defs>
      <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path className="hd" d="M0,0L10,5L0,10z" />
      </marker>
      <marker id="ac" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path className="hd-c" d="M0,0L10,5L0,10z" />
      </marker>
      <marker id="al" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path className="hd-l" d="M0,0L10,5L0,10z" />
      </marker>
    </defs>
  );
}

function Node({ x, y, w, h = 54, tone, kicker, label }: { x: number; y: number; w: number; h?: number; tone?: "lit" | "cool"; kicker: string; label: string }) {
  return (
    <g>
      <rect className={tone ? `node ${tone}` : "node"} x={x} y={y} width={w} height={h} rx={6} />
      <text className="t2" x={x + 14} y={y + 20}>
        {kicker}
      </text>
      <text className="t1" x={x + 14} y={y + h - 13}>
        {label}
      </text>
    </g>
  );
}

/** Four layers into a mix bus, two returns, and the kick sidechain. */
export function SignalMap() {
  return (
    <figure>
      <svg viewBox="0 0 780 320" role="img" aria-labelledby="mapT">
        <title id="mapT">Signal flow: four layers feed a mix bus to the master, with sends to two returns and a kick sidechain</title>
        <Arrows />
        <Node x={70} y={20} w={190} tone="cool" kicker="LAYER 1" label="Beds · audio loops" />
        <Node x={70} y={90} w={190} tone="cool" kicker="LAYER 2" label="Pads · Simpler" />
        <Node x={70} y={160} w={190} tone="lit" kicker="LAYER 3" label="Drums · Drum Rack" />
        <Node x={70} y={230} w={190} tone="lit" kicker="LAYER 4" label="Bass · sine sub" />
        <path className="w" d="M260,47H310M260,117H310M260,187H310M260,257H310M310,47V257" />
        <path className="w" d="M310,152H604" markerEnd="url(#a)" />
        <text className="t2" x={322} y={144}>MIX BUS</text>
        <Node x={410} y={20} w={170} tone="cool" kicker="RETURN A · LAYER 5" label="Space · reverb" />
        <Node x={410} y={230} w={170} tone="cool" kicker="RETURN B · LAYER 5" label="Echo · delay" />
        <path className="snd" d="M310,72C350,72 370,47 408,47" markerEnd="url(#ac)" />
        <path className="snd" d="M310,232C350,232 370,257 408,257" markerEnd="url(#ac)" />
        <text className="t2" x={330} y={98}>SENDS</text>
        <path className="w" d="M580,47C620,47 628,112 652,126" markerEnd="url(#a)" />
        <path className="w" d="M580,257C620,257 628,192 652,178" markerEnd="url(#a)" />
        <Node x={608} y={126} w={152} kicker="OUT" label="Master" />
        <path className="sc" d="M70,187C26,187 26,47 66,47" markerEnd="url(#al)" />
        <path className="sc" d="M70,187C40,187 40,257 66,257" markerEnd="url(#al)" />
        <text className="t2" x={10} y={310}>DASHED YELLOW · KICK DUCKS BEDS AND BASS (SIDECHAIN)</text>
      </svg>
      <figcaption>Blue is the haze, yellow is the pulse. Space only lives on the returns.</figcaption>
    </figure>
  );
}

/** Frequency regions on EQ Eight's log scale, with common problem areas marked. */
export function EqChart() {
  const X0 = 20;
  const W = 740;
  const L0 = Math.log10(20);
  const L1 = Math.log10(20000);
  const fx = (f: number) => X0 + ((Math.log10(f) - L0) / (L1 - L0)) * W;
  const k = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));
  const regions: [number, number, string][] = [
    [20, 60, "Sub"],
    [60, 250, "Bass"],
    [250, 500, "Low mids"],
    [500, 2000, "Mids"],
    [2000, 5000, "Presence"],
    [5000, 10000, "Brilliance"],
    [10000, 20000, "Air"],
  ];
  const problems: [number, number, string][] = [
    [200, 400, "MUD"],
    [2000, 5000, "HARSH"],
    [5000, 8000, "SIBILANCE"],
  ];
  return (
    <figure>
      <svg viewBox="0 0 780 200" role="img" aria-labelledby="eqT">
        <title id="eqT">Frequency regions from 20 Hz to 20 kHz on a log scale, with mud, harshness and sibilance marked</title>
        {regions.map(([a, b, name], i) => (
          <g key={name}>
            <rect className={i % 2 ? "band-b" : "band-a"} x={fx(a)} y={20} width={fx(b) - fx(a)} height={70} />
            <text className="t1" x={fx(a) + 6} y={44} style={{ fontSize: 12.5 }}>
              {name}
            </text>
            <text className="t2" x={fx(a) + 6} y={62}>
              {k(a)}–{k(b)}
            </text>
          </g>
        ))}
        {problems.map(([a, b, name], i) => (
          <g key={name}>
            <rect className="warn" x={fx(a)} y={108 + i * 22} width={fx(b) - fx(a)} height={14} rx={3} />
            <text className="t2" x={fx(b) + 6} y={119 + i * 22}>
              {name}
            </text>
          </g>
        ))}
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <line className="gl" x1={fx(f)} y1={92} x2={fx(f)} y2={100} />
            <text className="t2" x={fx(f)} y={192} textAnchor="middle">
              {k(f)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>A log scale, like EQ Eight. The yellow marks are where problems usually sit.</figcaption>
    </figure>
  );
}

/** 44-bar vignette timeline, timed at the current tempo. */
export function Arrangement() {
  const { settings } = useStore();
  const X0 = 86;
  const W = 670;
  const B = 44;
  const bx = (b: number) => X0 + (b / B) * W;
  const clock = (s: number) => {
    const r = Math.round(s);
    return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
  };
  const lanes: [string, string, [number, number][]][] = [
    ["Bed", "lane-bed", [[0, 44]]],
    ["Pad", "lane-pad", [[8, 40]]],
    ["Drums", "lane-drm", [[16, 32], [36, 40]]],
    ["Bass", "lane-bas", [[16, 40]]],
  ];
  return (
    <figure>
      <svg viewBox="0 0 780 270" role="img" aria-labelledby="arrT">
        <title id="arrT">A 44-bar arrangement: bed throughout, pad from bar 9 to 40, drums from 17 to 32 and 37 to 40, bass from 17 to 40</title>
        {([[0, "FOG"], [8, "PAD"], [16, "PULSE"], [32, "STRIP"], [36, "SWELL"], [40, "TAIL"]] as const).map(([b, n]) => (
          <text key={n} className="t2" x={bx(b) + 5} y={22}>
            {n}
          </text>
        ))}
        {[0, 8, 16, 24, 32, 40, 44].map((b) => {
          const end = b === 44;
          const anchor = end ? "end" : b === 0 ? "start" : "middle";
          return (
            <g key={b}>
              <line className="gl" x1={bx(b)} y1={32} x2={bx(b)} y2={214} />
              <text className="t2" x={bx(b)} y={236} textAnchor={anchor}>
                BAR {b + (end ? 0 : 1)}
              </text>
              <text className="t2" x={bx(b)} y={252} textAnchor={anchor}>
                {clock((b * 240) / settings.bpm)}
              </text>
            </g>
          );
        })}
        {lanes.map(([name, cls, segs], i) => (
          <g key={name}>
            <text className="t1" x={12} y={62 + i * 43}>
              {name}
            </text>
            {segs.map(([a, b]) => (
              <rect key={a} className={cls} x={bx(a) + 2} y={45 + i * 43} width={bx(b) - bx(a) - 4} height={24} rx={4} />
            ))}
          </g>
        ))}
      </svg>
      <figcaption>44 bars, with clock time at the current tempo. The gap in the drums is the strip-back.</figcaption>
    </figure>
  );
}

/** Chord synth as the vocoder's carrier, the vocal as its modulator. */
export function VocoderFlow() {
  return (
    <figure>
      <svg viewBox="0 0 780 190" role="img" aria-labelledby="vocT">
        <title id="vocT">A chord synth feeds the Vocoder on the vocal track as its carrier; the vocal is the modulator; the result goes to the plate return</title>
        <Arrows />
        <Node x={20} y={20} w={200} h={58} tone="lit" kicker="MIDI TRACK · CARRIER" label="Chord synth" />
        <Node x={20} y={110} w={200} h={58} tone="cool" kicker="AUDIO TRACK · MODULATOR" label="Your vocal" />
        <Node x={300} y={110} w={200} h={58} kicker="ON THE VOCAL TRACK" label="Vocoder · External" />
        <path className="sc" d="M220,49C270,49 280,80 300,110" markerEnd="url(#al)" />
        <text className="t2" x={238} y={40}>SIDECHAIN IN</text>
        <path className="w" d="M220,139H296" markerEnd="url(#a)" />
        <Node x={580} y={110} w={180} h={58} tone="cool" kicker="RETURN" label="Plate · SuperPlate" />
        <path className="w" d="M500,139H576" markerEnd="url(#a)" />
      </svg>
      <figcaption>The synth track only feeds the vocoder, so set its output to Sends Only and you hear just the vocoded voice.</figcaption>
    </figure>
  );
}

const PADS: [string, string, "k" | "t" | ""][] = [
  ["C1", "Kick", "k"], ["C♯1", "Rim", "k"], ["D1", "Snare", "k"], ["D♯1", "Clap", "k"],
  ["E1", "Texture hat A", "t"], ["F1", "Texture hat B", "t"], ["F♯1", "Closed hat", "k"], ["G1", "Low tom", "k"],
  ["G♯1", "Open hat", "k"], ["A1", "Perc", "k"], ["A♯1", "Shaker", "k"], ["B1", "Foley", "t"],
  ["C2", "Tape hiss", "t"], ["C♯2", "Swell", "t"], ["D2", "Reverse", "t"], ["D♯2", "Free", ""],
];

/** The Template tab's Drum Rack, laid out like Push: C1 bottom-left. */
export function Rack() {
  const rows = [3, 2, 1, 0].flatMap((r) => PADS.slice(r * 4, r * 4 + 4));
  return (
    <div className="rack">
      {rows.map(([note, name, tone]) => (
        <div key={note} className={tone || undefined}>
          <small>{note}</small>
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}
