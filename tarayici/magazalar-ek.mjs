// Ek mağazalar: Tamadres, Amazon TR, Hepsiburada, Trendyol. magazalar.mjs ile aynı sözleşme:
// ara(sorgu) -> [{ baslik, url, fiyat (TL | null), stok (bool) }], asla throw etmez. Bağımlılık yok (Node 20+ fetch; Trendyol için sistem curl'ü).
import { execFile } from "node:child_process";
import { HATALI } from "./magazalar.mjs";
import { promisify } from "node:util";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
// Amazon/Hepsiburada bot korumasından (Akamai) yalın istekle 403/503 dönüyor; gerçek Chrome'un gezinme başlıklarıyla geçiyor.
const TARAYICI = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

async function getir(url, { json, ...secenek } = {}) {
  const r = await fetch(url, {
    ...secenek,
    headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7", Accept: json ? "application/json" : "text/html,application/xhtml+xml,*/*;q=0.8", ...secenek.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return json ? r.json() : r.text();
}

const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const coz = (s = "") => s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const metin = (s = "") => coz(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const tl = (s) => {
  if (typeof s === "number") return s;
  const t = String(s ?? "").replace(/[^\d.,]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};
const sayfaSiniri = 3;

function magaza(id, ad, fn) {
  return {
    id, ad,
    ara: async (sorgu) => {
      try {
        const r = await fn(sorgu);
        const diger = sorgu.replace(/['’]/g, (c) => (c === "'" ? "’" : "'"));
        return r.length || diger === sorgu ? r : await fn(diger);
      } catch (e) { console.error(`[${id}] ${e.message}`); HATALI.add(id); return []; }
    },
  };
}

// Tamadres: Next.js önyüzü, arka uç Magento. /arama?q= sayfası sonuçları RSC akışında ("initialProducts") JSON olarak gömüyor; 25'li, &page=N.
// Stok: stock.sellable (ürün sayfasında "Sepete Ekle" ↔ schema.org/InStock, false ise "Stokta yok").
async function tamadres(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://tamadres.com/arama?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`);
    let rsc = "";
    for (const m of h.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) rsc += JSON.parse(m[1]);
    const i = rsc.indexOf('"initialProducts":');
    if (i < 0) throw new Error("initialProducts bulunamadı (sayfa yapısı değişmiş olabilir)");
    // initialProducts dizisinin sonunu köşeli parantez dengesiyle bul (string içindekileri sayma)
    let d = 0, j = i + 18, str = false;
    for (; j < rsc.length; j++) {
      const c = rsc[j];
      if (str) { if (c === "\\") j++; else if (c === '"') str = false; }
      else if (c === '"') str = true;
      else if (c === "[" || c === "{") d++;
      else if ((c === "]" || c === "}") && --d === 0) break;
    }
    for (const x of JSON.parse(rsc.slice(i + 18, j + 1))) {
      sonuc.push({ baslik: x.name, url: `https://tamadres.com/${x.canonicalPath || x.slug}`, fiyat: tl(x.price?.amount), stok: x.stock?.sellable === true });
    }
    const toplamSayfa = +rsc.match(/"initialPageInfo":\{[^}]*"totalPages":(\d+)/)?.[1] || 1;
    if (p >= toplamSayfa) break;
  }
  return sonuc;
}

// Cloudflare, Trendyol'da Node'un (undici/OpenSSL) TLS parmak izini başlıklardan bağımsız olarak 403 ile engelliyor
// (Node 20 ve 24 denendi; aynı istek curl ve Python urllib ile 200). Bu yüzden Trendyol isteği sistemdeki curl ile atılıyor
// (ubuntu-latest'te kurulu). ponytail: curl yoksa / o da engellenirse Trendyol boş döner.
const execFileP = promisify(execFile);
async function curlJson(url, basliklar) {
  const { stdout } = await execFileP("curl", ["-sS", "--fail", "--max-time", "20", "-A", UA, ...Object.entries(basliklar).flatMap(([k, v]) => ["-H", `${k}: ${v}`]), url], { maxBuffer: 50 << 20 });
  return JSON.parse(stdout);
}

// Trendyol: www.trendyol.com arama HTML'i Cloudflare arkasında; önyüzün çağırdığı arama ağ geçidi JSON'u kullanılıyor
// (countryCode=TR zorunlu, yoksa 418). wc=91 = "Kitap" kategorisi (figür/tişört/poster eleniyor). 36'lı, pi=N.
// Stok: arama yalnızca satıştaki ilanları döndürüyor; ek olarak tagStockBar.isSoldOut. Fiyat: sepette indirimli fiyat.
async function trendyol(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const e = encodeURIComponent(q);
    const j = await curlJson(`https://apigw.trendyol.com/discovery-sfint-search-service/api/search/products?q=${e}&qt=${e}&st=${e}&os=1&pi=${p}&wc=91&culture=tr-TR&channelId=1&countryCode=TR`, {
      Accept: "application/json", "Accept-Language": "tr-TR,tr;q=0.9", Origin: "https://www.trendyol.com", Referer: "https://www.trendyol.com/",
    });
    const urunler = j.products ?? [];
    for (const x of urunler) {
      const u = new URL(x.url, "https://www.trendyol.com");
      const satici = u.searchParams.get("merchantId");
      u.search = satici ? `?merchantId=${satici}` : ""; // satıcı sabit kalsın ki fiyat tutsun
      sonuc.push({ baslik: x.name, url: u.href, fiyat: tl(x.price?.discountedPrice || x.price?.current), stok: x.tagStockBar?.isSoldOut !== true });
    }
    if (!urunler.length || sonuc.length >= (j.total ?? 0)) break;
  }
  return sonuc;
}

// Hepsiburada: /ara sayfası Akamai arkasında; tam Chrome başlıklarıyla 200 dönüyor. Sonuçlar, sayfadaki reduxStore JSON'unun
// içindeki ProductList parçasının HTML'inde 'STATE': {...} olarak gömülü. Kategori Kitap'a (2147483645) sabitleniyor. 36'lı, &sayfa=N.
// Stok: varyantın procurable alanı (satın alınabilir) ve ön sipariş değil.
async function hepsiburada(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://www.hepsiburada.com/ara?q=${encodeURIComponent(q)}&filtreler=AllCategories.Child.CategoryId:2147483645${p > 1 ? `&sayfa=${p}` : ""}`, { headers: TARAYICI });
    const store = h.match(/id="reduxStore">\s*([\s\S]*?)<\/script>/);
    if (!store) throw new Error(/HBBlockandCaptcha/.test(h) ? "bot korumasına takıldı" : "reduxStore bulunamadı");
    const parca = Object.values(JSON.parse(store[1]).voltranState?.fragmentsMap ?? {}).map((f) => f.ProductList).find(Boolean);
    const durum = parca?.html.match(/'STATE': (\{"data":\{"products":.*)/)?.[1];
    if (!durum) break; // sonuç yok
    const d = JSON.parse(durum.trim().replace(/,$/, "")).data;
    for (const x of d.products) {
      const v = x.variantList?.find((v) => v.isDefault) ?? x.variantList?.[0];
      if (!v) continue;
      sonuc.push({ baslik: v.name, url: new URL(v.url, "https://www.hepsiburada.com").href, fiyat: tl(v.listing?.priceInfo?.price), stok: v.procurable === true && !v.listing?.isPreOrder });
    }
    if (p >= (d.lastPage ?? 1)) break;
  }
  return sonuc;
}

// Amazon TR: /s?k=...&i=stripbooks (yalnızca Kitaplar), tam Chrome başlıklarıyla. Sponsorlu kartlar atlanıyor (organik tekrarı var).
// Stok: kartta fiyat var ve "Sepete ekle" ya da "Seçenekleri gör" (birden çok teklif) var; tükenende fiyat/buton çıkmıyor.
// CAPTCHA sayfası dönerse (veri merkezi IP'lerinde sık) boş döner; CAPTCHA çözülmez.
async function amazon(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://www.amazon.com.tr/s?k=${encodeURIComponent(q)}&i=stripbooks${p > 1 ? `&page=${p}` : ""}`, { headers: TARAYICI });
    if (/validateCaptcha|opfcaptcha/.test(h)) throw new Error("CAPTCHA sayfası döndü");
    for (const b0 of h.split(/<div role="listitem" data-asin="/).slice(1)) {
      const asin = b0.slice(0, b0.indexOf('"'));
      const b = b0.slice(0, 60_000);
      if (!/^[A-Z0-9]{10}$/.test(asin) || /puis-sponsored-label-text/.test(b)) continue;
      const baslik = metin(b.match(/<h2[^>]*aria-label="([^"]*)"/)?.[1] ?? b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
      if (!baslik) continue;
      const fiyat = tl(b.match(/<span class="a-price"[^>]*><span class="a-offscreen">([^<]*)/)?.[1]);
      sonuc.push({ baslik, url: `https://www.amazon.com.tr/dp/${asin}`, fiyat, stok: fiyat != null && /submit\.addToCart|Seçenekleri gör/.test(b) });
    }
    if (!/<a[^>]*class="[^"]*s-pagination-next/.test(h)) break;
  }
  return sonuc;
}

export const EK_MAGAZALAR = [
  magaza("tamadres", "Tamadres", tamadres),
  magaza("amazon", "Amazon TR", amazon),
  magaza("hepsiburada", "Hepsiburada", hepsiburada),
  magaza("trendyol", "Trendyol", trendyol),
];
