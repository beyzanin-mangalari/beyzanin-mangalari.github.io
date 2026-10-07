// Kullanım: node tarayici/tara.mjs <mangalar.json> <stok.json>
// Her seriyi her mağazada arar, cilt numarasını başlıktan çıkarır, stok.json yazar.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { MAGAZALAR as ANA, HATALI, urunKontrol } from "./magazalar.mjs";
import { EK_MAGAZALAR } from "./magazalar-ek.mjs";
const MAGAZALAR = [...ANA, ...EK_MAGAZALAR];
import { ciltNo, yabanci, turkceCilt, kesinCilt, urunSayfasi } from "./cilt.mjs";

const [, , girdi = "mangalar.json", cikti = "stok.json"] = process.argv;
const mangalar = JSON.parse(readFileSync(girdi, "utf8"));
// GitHub sunucularını engelleyen mağazalar (Kitapyurdu, D&R...) için önceki taramanın ilanları korunur
let onceki = {};
try { if (existsSync(cikti)) onceki = JSON.parse(readFileSync(cikti, "utf8")).mangalar || {}; } catch {}

const sonuc = { guncel: new Date().toISOString(), mangalar: {} };
for (const m of mangalar) {
  const sorgu = m.ara || m.ad, ciltler = {};
  let sonGorulen = 0;
  for (const mg of MAGAZALAR) {
    HATALI.delete(mg.id);
    const bulunan = await mg.ara(sorgu);
    if (HATALI.has(mg.id)) {
      for (const [n, l] of Object.entries(onceki[m.id]?.ciltler || {}))
        for (const x of l) if (x.magaza === mg.id) (ciltler[n] ||= []).push({ ...x, onceki: true });
    }
    for (const u of bulunan) {
      const n = !urunSayfasi(u.url) || yabanci(u.baslik, u) ? null : ciltNo(u.baslik, sorgu);
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
  // Sitede satın alma linki olarak çıkacak ciltler (alinan sonrası): stoklu her ilanın ürün sayfası açılır;
  // sayfa başka ürüne/ana sayfaya düşüyorsa ilan atılır, sayfa stokta demiyorsa (ön sipariş, tükendi, açılmadı) stok=false.
  for (const n of Object.keys(ciltler).filter(n => +n > (m.alinan || 0))) {
    for (const x of [...ciltler[n]].filter(x => x.stok && !x.onceki)) {
      const k = await urunKontrol(x.url);
      if (k && (!urunSayfasi(k.url) || yabanci(k.baslik) || ciltNo(k.baslik, sorgu) !== +n)) ciltler[n].splice(ciltler[n].indexOf(x), 1);
      else x.stok = !!k?.stok;
    }
    if (!ciltler[n].length) delete ciltler[n];
  }
  // son görülen = iki mağazada stokta olan en yüksek cilt; ondan ve bilinen son cilt (cikan) üstündeki zayıf kanıtlı ciltler atılır
  sonGorulen = Math.max(0, ...Object.keys(ciltler).filter(n => kesinCilt(ciltler[n])).map(Number));
  for (const n of Object.keys(ciltler)) if (+n > Math.max(sonGorulen, m.cikan || 0)) delete ciltler[n];
  sonuc.mangalar[m.id] = { sonGorulen, ciltler };
  console.log(`${m.ad}: son görülen ${sonGorulen}, ${Object.keys(ciltler).length} cilt bulundu`);
}
sonuc.magazalar = Object.fromEntries(MAGAZALAR.map(m => [m.id, m.ad]));
writeFileSync(cikti, JSON.stringify(sonuc));
