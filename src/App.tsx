import { useState } from "react";
import { NowScreen } from "./screens/NowScreen";
import { MapScreen } from "./screens/MapScreen";
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
  return (
    <div className="app">
      <main className="main">
        {tab === "nu" && <NowScreen />}
        {tab === "kort" && <MapScreen />}
        {tab === "historik" && <HistoryScreen />}
        {tab === "log" && <LogScreen />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
