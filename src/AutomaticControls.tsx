import { useState } from "react";
import { tracks, type Track } from "./engine/model";
import { automaticProfiles } from "./engine/automatic";
const labels: Record<Track, string> = {
  baby: "Başlangıç",
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
  expert: "Uzman",
};
export const defaultPlan: Record<Track, number> = {
  baby: 30,
  easy: 100,
  medium: 200,
  hard: 250,
  expert: 250,
};
export function AutomaticControls({
  busy,
  onRun,
  onManual,
  onUpgrade,
  onSilhouettes,
}: {
  busy: boolean;
  onRun: (plan: Partial<Record<Track, number>>) => void;
  onManual: () => void;
  onUpgrade: () => void;
  onSilhouettes: () => void;
}) {
  const [track, setTrack] = useState<Track>("baby"),
    [count, setCount] = useState(30),
    [plan, setPlan] = useState(defaultPlan);
  const profile = automaticProfiles[track],
    total = tracks.reduce((n, t) => n + plan[t], 0);
  return (
    <>
      <div className="panel-title">
        <h2>Otomatik üretim</h2>
        <span>✧</span>
      </div>
      <p className="automatic-intro">
        Sadece seviyeyi ve adedi seçin. Tahta, özgün parçalar ve başlangıç
        ipuçları otomatik hazırlanır.
      </p>
      <label htmlFor="auto-track">Zorluk seviyesi</label>
      <select
        id="auto-track"
        value={track}
        disabled={busy}
        onChange={(e) => setTrack(e.target.value as Track)}
      >
        {tracks.map((t) => (
          <option key={t} value={t}>
            {labels[t]}
          </option>
        ))}
      </select>
      <label htmlFor="auto-count">Bölüm adedi</label>
      <input
        id="auto-count"
        type="number"
        min="1"
        max="1000"
        disabled={busy}
        value={count}
        onChange={(e) => setCount(Math.max(1, Math.min(1000, +e.target.value)))}
      />
      <div className="auto-profile">
        <b>
          {profile.width} × {profile.height} tahta · {profile.sizes.length}{" "}
          parça
        </b>
        <p>
          {track === "hard" || track === "expert"
            ? "Başlangıçta sabit parça yok. Tüm parçaları siz yerleştirirsiniz. Birden fazla geçerli çözüm kabul edilir."
            : "Seviyeye özel parçalar ve azalan başlangıç ipuçları kullanılır. Tek çözümlülük doğrulanır."}{" "}
          Tahmini zorluk yeni ölçeğe göre ölçülür.
        </p>
      </div>
      <button
        className="primary full"
        disabled={busy}
        onClick={() => onRun({ [track]: count })}
      >
        {count} {labels[track].toLocaleLowerCase("tr-TR")} bölüm üret
      </button>
      <details className="automatic-plan">
        <summary>Birden fazla seviye için üretim planı</summary>
        {tracks.map((t) => (
          <label key={t} htmlFor={`plan-${t}`}>
            {labels[t]}
            <input
              id={`plan-${t}`}
              type="number"
              min="0"
              max="1000"
              disabled={busy}
              value={plan[t]}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  [t]: Math.max(0, Math.min(1000, +e.target.value)),
                }))
              }
            />
          </label>
        ))}
        <button
          className="primary full"
          disabled={busy || !total}
          onClick={() => onRun(plan)}
        >
          Planın tamamını üret · {total} bölüm
        </button>
      </details>
      <p className="muted">
        Kabul edilenler kataloğa otomatik eklenir. Durdurursanız üretilenler
        korunur. Zorluk, henüz insan oyuncularla kalibre edilmemiş bir
        tahmindir.
      </p>
      <div className="auto-profile">
        <b>Özel silüet koleksiyonu</b>
        <p>
          20 tanınabilir şekil × 5 ayrıntılı ölçek. En az orta zorluk; serinin
          üst ucunda 30 parçaya kadar daha büyük bulmacalar.
        </p>
        <button className="full" disabled={busy} onClick={onSilhouettes}>
          100 silüet bölümünü üret ve ekle
        </button>
      </div>
      <button className="full" disabled={busy} onClick={onUpgrade}>
        Mevcut otomatik bölümleri yeni ölçeğe uyarla
      </button>
      <button className="text-button" disabled={busy} onClick={onManual}>
        Gelişmiş ayarları elle düzenle →
      </button>
    </>
  );
}
