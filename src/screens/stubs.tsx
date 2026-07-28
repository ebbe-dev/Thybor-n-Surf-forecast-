// Pladsholdere for etape 2–4. Ingen falsk funktionalitet — de siger
// bare hvad der kommer.

function Stub({ title, etape, text }: { title: string; etape: number; text: string }) {
  return (
    <div className="screen stub">
      <h2>{title}</h2>
      <p className="muted">Kommer i etape {etape}.</p>
      <p>{text}</p>
    </div>
  );
}

export const MapScreen = () => (
  <Stub
    title="Kort"
    etape={2}
    text="Leaflet-kort over tangen med spots farvet efter score og en tidsskyder over de 7 døgn."
  />
);

export const HistoryScreen = () => (
  <Stub
    title="Historik"
    etape={3}
    text="Kalender-heatmap, vindrose og scorefordeling over 12 måneder. Marine-arkivets rækkevidde verificeres først."
  />
);

export const LogScreen = () => (
  <Stub
    title="Log"
    etape={4}
    text="Sessions med karakter, note og forecast-snapshot, gemt i Google Sheets via Apps Script."
  />
);
