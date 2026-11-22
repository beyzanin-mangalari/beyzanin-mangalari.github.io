// Kullanım: node tarayici/tara.mjs <mangalar.json> <stok.json>
// Her seriyi her mağazada arar, cilt numarasını başlıktan çıkarır, stok.json yazar.
// İlan durumu: stok (satışta) / on (ön siparişte) / ikisi de false (sayfası var, stok yok).
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

// ---------- canlı ilerleme: sitedeki tarama panelinin okuduğu ilerleme.json, ayrı `ilerleme` dalına ~3 sn'de bir ----------
// GH_TOKEN + GITHUB_REPOSITORY yoksa (yerelde) kapalı. Dal her taramada site'nin ucuna sıfırlanır, geçmiş birikmez.
const REPO = process.env.GITHUB_REPOSITORY, TOKEN = process.env.GH_TOKEN;
let ilAcik = !!(REPO && TOKEN), ilSha = null, ilSon = 0, ilBekleyen = null, ilYazim = Promise.resolve();
const ilerleme = {
  baslangic: new Date().toISOString(), durum: "suruyor",
  magazalar: Object.fromEntries(MAGAZALAR.map(m => [m.id, m.ad])),
  mangalar: mangalar.map(m => ({ id: m.id, ad: m.ad, m: Object.fromEntries(MAGAZALAR.map(mg => [mg.id, { d: "bekliyor" }])) })),
};
async function api(yol, method = "GET", govde) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${yol}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" }, body: govde && JSON.stringify(govde) });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${method} ${yol}`);
  return r.json();
}
async function ilerlemeHazirla() {
  if (!ilAcik) return;
  try {
    const { object } = await api("git/ref/heads/site");
    try { await api("git/refs/heads/ilerleme", "PATCH", { sha: object.sha, force: true }); }
    catch { await api("git/refs", "POST", { ref: "refs/heads/ilerleme", sha: object.sha }); }
  } catch (e) { console.error("ilerleme kapalı:", e.message); ilAcik = false; }
}
function ilerlemeYaz(son = false) {
  if (!ilAcik) return ilYazim;
  if (!son && Date.now() - ilSon < 3000) { ilBekleyen ||= setTimeout(() => { ilBekleyen = null; ilerlemeYaz(); }, 3000); return ilYazim; }
  clearTimeout(ilBekleyen); ilBekleyen = null; ilSon = Date.now();
  const icerik = Buffer.from(JSON.stringify(ilerleme)).toString("base64");
  return ilYazim = ilYazim.then(async () => {
    try {
      if (!ilSha) try { ilSha = (await api("contents/ilerleme.json?ref=ilerleme")).sha; } catch {}
      ilSha = (await api("contents/ilerleme.json", "PUT", { message: "ilerleme", branch: "ilerleme", content: icerik, ...(ilSha ? { sha: ilSha } : {}) })).content.sha;
    } catch (e) { console.error("ilerleme yazılamadı:", e.message); ilSha = null; }
  });
}
await ilerlemeHazirla();
ilerlemeYaz(true);

const sira = x => x.stok ? 2 : x.on ? 1 : 0; // aynı mağazada aynı cilt: satışta > ön sipariş > stok yok
const sonuc = { guncel: new Date().toISOString(), mangalar: {} };
for (const [mi, m] of mangalar.entries()) {
  const sorgu = m.ara || m.ad, ciltler = {}, il = ilerleme.mangalar[mi].m;
  for (const mg of MAGAZALAR) {
    il[mg.id].d = "araniyor"; ilerlemeYaz();
    HATALI.delete(mg.id);
    const bulunan = await mg.ara(sorgu);
    if (HATALI.has(mg.id)) {
      il[mg.id].hata = true;
      for (const [n, l] of Object.entries(onceki[m.id]?.ciltler || {}))
        for (const x of l) if (x.magaza === mg.id) (ciltler[n] ||= []).push({ ...x, onceki: true });
    }
    for (const u of bulunan) {
      const n = !urunSayfasi(u.url) || yabanci(u.baslik, u) ? null : ciltNo(u.baslik, sorgu);
      if (!n) continue;
      // aynı mağazada aynı cilt için en iyi durumdaki, eşitse en ucuz ilanı tut
      const liste = (ciltler[n] ||= []), eski = liste.find(x => x.magaza === mg.id);
      const yeni = { magaza: mg.id, baslik: u.baslik, url: u.url, fiyat: u.fiyat, stok: !!u.stok, on: !u.stok && !!u.on };
      if (!eski) liste.push(yeni);
      else if (sira(yeni) > sira(eski) || (sira(yeni) === sira(eski) && (u.fiyat ?? 1e9) < (eski.fiyat ?? 1e9))) Object.assign(eski, yeni);
    }
    il[mg.id].d = "dogrulaniyor"; ilerlemeYaz();
    await new Promise(r => setTimeout(r, 800)); // mağazaları yormamak için
  }
  for (const n of Object.keys(ciltler)) if (!turkceCilt(ciltler[n])) delete ciltler[n];
  // Alınanların üstündeki ciltler: satışta/ön siparişte görünen her ilanın ürün sayfası açılır;
  // sayfa başka ürüne/ana sayfaya düşüyorsa ilan atılır, durumu (satışta / ön sipariş / stok yok) sayfadan alınır.
  for (const n of Object.keys(ciltler).filter(n => +n > (m.alinan || 0))) {
    for (const x of [...ciltler[n]].filter(x => (x.stok || x.on) && !x.onceki)) {
      const k = await urunKontrol(x.url);
      if (k && (!urunSayfasi(k.url) || yabanci(k.baslik) || ciltNo(k.baslik, sorgu) !== +n)) ciltler[n].splice(ciltler[n].indexOf(x), 1);
      else { x.stok = !!k?.stok; x.on = k ? !k.stok && !!k.on : x.on; } // sayfa açılmadıysa satışta sayılmaz, kartın ön sipariş bilgisi kalır
    }
    if (!ciltler[n].length) delete ciltler[n];
  }
  // son görülen = en az bir mağazada satışta ya da ön siparişte olan en yüksek cilt
  const sonGorulen = Math.max(0, ...Object.keys(ciltler).filter(n => kesinCilt(ciltler[n])).map(Number));
  // stoksuz ilanlar da tutulur ("satışa açılabilir"); ponytail: hatalı başlık eşleşmesi çöp cilt üretmesin diye en fazla 3 cilt ilerisi
  for (const n of Object.keys(ciltler)) if (+n > Math.max(sonGorulen, m.cikan || 0) + 3) delete ciltler[n];
  sonuc.mangalar[m.id] = { sonGorulen, ciltler };
  // ilerleme: her mağazanın alınanların üstündeki ciltlerde ne bulduğu
  for (const mg of MAGAZALAR) {
    const ozet = { stok: [], on: [], yok: [] };
    for (const [n, l] of Object.entries(ciltler)) if (+n > (m.alinan || 0))
      for (const x of l) if (x.magaza === mg.id) ozet[x.stok ? "stok" : x.on ? "on" : "yok"].push(+n);
    Object.assign(il[mg.id], { d: "bitti" }, ozet);
  }
  ilerlemeYaz();
  console.log(`${m.ad}: son görülen ${sonGorulen}, ${Object.keys(ciltler).length} cilt bulundu`);
}
sonuc.magazalar = Object.fromEntries(MAGAZALAR.map(m => [m.id, m.ad]));
writeFileSync(cikti, JSON.stringify(sonuc));
ilerleme.durum = "bitti"; ilerleme.bitis = new Date().toISOString();
await ilerlemeYaz(true);
