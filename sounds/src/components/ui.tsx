import { Link } from "@tanstack/react-router";
import { Children, isValidElement, type ReactNode } from "react";
import { useStore } from "~/lib/store";
import { diatonicChords, keyName, scaleNotes } from "~/lib/music";

/** A spec sheet: a headed grid of labelled cells. */
export function Sheet({ head, sub, children }: { head: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="gf">
      <div className="gf-h">
        {head}
        {sub ? <span>{sub}</span> : null}
      </div>
      {children}
    </div>
  );
}

type Tone = "lit" | "cool";

interface CellProps {
  l: ReactNode;
  children?: ReactNode;
  span?: number;
  tone?: Tone;
  /** Monospaced, tabular figures. */
  num?: boolean;
}

export function Cell({ l, children, span = 1, tone, num }: CellProps) {
  const cls = ["f", span > 1 ? `s${span}` : "", tone ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="lab">{l}</div>
      <div className={num ? "v num" : "v"}>{children}</div>
    </div>
  );
}

/** A row of cells; its column count is the sum of the cells' spans. */
export function Row({ children }: { children: ReactNode }) {
  const cols = Children.toArray(children).reduce<number>(
    (n, c) => n + (isValidElement<CellProps>(c) ? (c.props.span ?? 1) : 1),
    0,
  );
  return (
    <div className="gf-r" style={{ "--cols": cols } as React.CSSProperties}>
      {children}
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="steps">
      {Children.map(children, (c) => (
        <li>
          <div>{c}</div>
        </li>
      ))}
    </ol>
  );
}

export function Task({ children }: { children: ReactNode }) {
  return (
    <div className="task">
      <div className="lab">Your turn</div>
      <div>{children}</div>
    </div>
  );
}

export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="note">
      <b>{label}</b> {children}
    </p>
  );
}

export function Logo({ big }: { big?: boolean }) {
  return (
    <span className={big ? "logo big" : "logo"} aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} className={i === 12 ? "on" : undefined} />
      ))}
    </span>
  );
}

/** The current key's scale and diatonic triads. */
export function KeyBox() {
  const { settings } = useStore();
  const notes = scaleNotes(settings);
  const chords = diatonicChords(settings);
  return (
    <div className="keybox">
      <div className="gf-h">
        In this key<span>{keyName(settings)}</span>
      </div>
      <div className="keyrow">
        {notes.map((n, i) => (
          <div key={i} className={i === 0 ? "tonic" : undefined}>
            <small>{i + 1}</small>
            <b>{n}</b>
          </div>
        ))}
      </div>
      <div className="keyrow">
        {chords.map((c, i) => (
          <div key={i} className={c.tonic ? "tonic" : undefined}>
            <small className="rn">{c.roman}</small>
            <b>{c.name}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHORDS_URL = "https://chords.charliegleason.com";

export function Crumbs({ section }: { section: ReactNode }) {
  return (
    <nav className="crumbs">
      <Link to="/">Fog &amp; Pulse</Link>
      <span>/</span>
      <span>{section}</span>
    </nav>
  );
}
