import { useState } from "react";
import { NowScreen } from "./screens/NowScreen";
import { MapScreen, type MapFocus } from "./screens/MapScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { LogScreen } from "./screens/LogScreen";

const TABS = [
  { id: "nu", label: "NU" },
  { id: "kort", label: "KORT" },
  { id: "historik", label: "HISTORIK" },
  { id: "log", label: "LOG" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<TabId>("nu");
  // "Tjek på kortet": NU sender et spot til kortet, og kortet sender én
  // tilbage til NU, når tjekket er bekræftet eller annulleret. NU åbner så
  // på det spot — ellers på dommens spot som altid.
  const [checkSpotId, setCheckSpotId] = useState<string | null>(null);
  const [nuSpotId, setNuSpotId] = useState<string | null>(null);
  // Dobbelttryk på et spot på NU: kortet åbner på spottet til det tidspunkt.
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);

  const openMapAt = (spotId: string, time: string) => {
    setNuSpotId(spotId);
    setMapFocus({ spotId, time, key: Date.now() });
    setTab("kort");
  };

  const startCheck = (spotId: string) => {
    setNuSpotId(spotId);
    setCheckSpotId(spotId);
    setTab("kort");
  };
  const endCheck = () => {
    setCheckSpotId(null);
    setTab("nu");
  };

  return (
    <div className="app">
      <main className="main">
        {tab === "nu" && (
          <NowScreen initialSpotId={nuSpotId} onCheckOnMap={startCheck} onOpenMap={openMapAt} />
        )}
        {tab === "kort" && (
          <MapScreen checkSpotId={checkSpotId} onCheckDone={endCheck} focus={mapFocus} />
        )}
        {tab === "historik" && <HistoryScreen />}
        {tab === "log" && <LogScreen />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => {
              // et fane-skift afbryder et tjek uden at gemme
              setCheckSpotId(null);
              setNuSpotId(null);
              setMapFocus(null);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
