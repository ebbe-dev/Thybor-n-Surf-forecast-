// Fælles top på alle skærme: navnet, én linje status til højre og én
// ?-knap, der folder skærmens forklaringer ud lige nedenunder — i stedet
// for forklaringsbokse spredt ud mellem indholdet.

import { useState, type ReactNode } from "react";

export function ScreenHeader({ right, help }: { right?: ReactNode; help?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="hdr">
        <span className="brand">Byg Tangen</span>
        <span className="hdr-right">{right}</span>
        {help && (
          <button
            className={"iconbtn" + (open ? " on" : "")}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="forklaringer"
          >
            ?
          </button>
        )}
      </header>
      {help && open && <section className="card help-card">{help}</section>}
    </>
  );
}
