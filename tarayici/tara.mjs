// Kullanım: node tarayici/tara.mjs <mangalar.json> <stok.json>
// Her seriyi her mağazada arar, cilt numarasını başlıktan çıkarır, stok.json yazar.
import { readFileSync, writeFileSync } from "node:fs";
import { MAGAZALAR } from "./magazalar.mjs";
import { ciltNo, yabanci, turkceCilt } from "./cilt.mjs";

const [, , girdi = "mangalar.json", cikti = "stok.json"] = process.argv;
const mangalar = JSON.parse(readFileSync(girdi, "utf8"));

const sonuc = { guncel: new Date().toISOString(), mangalar: {} };
for (const m of mangalar) {
  const sorgu = m.ara || m.ad, ciltler = {};
  let sonGorulen = 0;
  for (const mg of MAGAZALAR) {
    for (const u of await mg.ara(sorgu)) {
      const n = yabanci(u.baslik) ? null : ciltNo(u.baslik, sorgu);
      if (!n) continue;
      // aynı mağazada aynı cilt için en ucuz stoklu ilanı tut
      const liste = (ciltler[n] ||= []), eski = liste.find(x => x.magaza === mg.id);
      const yeni = { magaza: mg.id, baslik: u.baslik, url: u.url, fiyat: u.fiyat, stok: u.stok };
      if (!eski) liste.push(yeni);
      else if ((u.stok && !eski.stok) || (u.stok === eski.stok && (u.fiyat ?? 1e9) < (eski.fiyat ?? 1e9))) Object.assign(eski, yeni);
    }
    await new Promise(r => setTimeout(r, 800)); // mağazaları yormamak için
  }
  for (const n of Object.keys(ciltler)) if (!turkceCilt(ciltler[n])) delete ciltler[n];
  sonGorulen = Math.max(0, ...Object.keys(ciltler).map(Number));
  sonuc.mangalar[m.id] = { sonGorulen, ciltler };
  console.log(`${m.ad}: son görülen ${sonGorulen}, ${Object.keys(ciltler).length} cilt bulundu`);
}
sonuc.magazalar = Object.fromEntries(MAGAZALAR.map(m => [m.id, m.ad]));
writeFileSync(cikti, JSON.stringify(sonuc));
