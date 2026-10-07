// Türk kitap/manga mağazaları için arama tarayıcıları. Bağımlılık yok: Node 20+ yerleşik fetch.
// Her magaza.ara(sorgu) -> [{ baslik, url, fiyat (TL | null), stok (bool) }], asla throw etmez.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function getir(url, { json, ...secenek } = {}) {
  const r = await fetch(url, {
    ...secenek,
    headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8", Accept: json ? "application/json" : "text/html,application/xhtml+xml,*/*;q=0.8", ...secenek.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return json ? r.json() : r.text();
}

const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const coz = (s = "") => s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const metin = (s = "") => coz(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
// "1.234,56 TL" -> 1234.56 ; "180" / 180 -> 180
const tl = (s) => {
  if (typeof s === "number") return s;
  const t = String(s ?? "").replace(/[^\d.,]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};
const bul = (s, re) => s.match(re)?.[1];
const sayfaSiniri = 3; // sayfalı mağazalarda en fazla bu kadar sayfa (ilk sayfalar alaka sıralı, sonrası çoğunlukla bulanık eşleşme)

function magaza(id, ad, fn) {
  return {
    id, ad,
    ara: async (sorgu) => {
      try {
        const r = await fn(sorgu);
        // Bazı mağazalar kesme işaretini harfiyen eşliyor (Kitapsepeti "Hikaru'nun" bulmaz, "Hikaru’nun" bulur): boşsa diğeriyle dene
        const diger = sorgu.replace(/['’]/g, (c) => (c === "'" ? "’" : "'"));
        return r.length || diger === sorgu ? r : await fn(diger);
      } catch (e) { console.error(`[${id}] ${e.message}`); return []; }
    },
  };
}

// Kitapyurdu: limit=100 ile tek sayfa; stokta olanlar önce, tükenenler sonda listeleniyor.
// Stok: kartın ilk CTA'sı "Sepete Ekle" (data-action="add-to-cart") ise var; tükenenlerde "Ürünü İncele" linki çıkıyor.
async function kitapyurdu(q) {
  const h = await getir(`https://www.kitapyurdu.com/index.php?route=product/search&filter_name=${encodeURIComponent(q)}&limit=100`);
  return h.split(/<div\s+class="ky-product" data-product-id=/).slice(1).map((b) => {
    const a = b.match(/class="ky-product-title" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) return null;
    return {
      baslik: metin(a[2]),
      url: coz(a[1]).replace(/\?.*$/, ""),
      fiyat: tl(bul(b, /ky-product-sell-price[^>]*>\s*([\d.,]+)/)),
      stok: /data-action="add-to-cart"/.test(bul(b, /(<[^>]*ky-product-cta[^>]*>)/) ?? ""),
    };
  }).filter(Boolean);
}

// D&R: 50'şer sayfa, Page=N. Arama varsayılan olarak yalnızca satılabilir ürünleri listeliyor;
// yine de GTM verisindeki item_stock ve sepete ekle butonuna bakıyoruz.
async function dr(q) {
  const sonuc = [];
  let gorulen = 0;
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://www.dr.com.tr/search?q=${encodeURIComponent(q)}${p > 1 ? `&Page=${p}` : ""}`);
    const kartlar = h.split(/<div class="product-card prd js-prd-item"/).slice(1);
    gorulen += kartlar.length;
    for (const b of kartlar) {
      const a = b.match(/<h3 class="seo-heading"><a href="([^"]+)" title="([^"]*)"/);
      if (!a || /data-ebook="True"/.test(b) || a[1].startsWith("/ekitap/")) continue; // e-kitapları atla
      sonuc.push({
        baslik: coz(a[2]),
        url: new URL(coz(a[1]), "https://www.dr.com.tr").href,
        // "Sepette" kampanya fiyatı varsa o ödenen fiyat, yoksa normal fiyat
        fiyat: tl(bul(b, /campaign-price-old">[^<]*<\/span>\s*<span>([^<]*)/) ?? bul(b, /class="prd-price"[^>]*>([^<]*)/)),
        stok: !/item_stock&quot;:&quot;No/.test(b) && /js-add-basket/.test(b),
      });
    }
    const toplam = +bul(h, /js-total-product-page" value="(\d+)"/) || 0;
    if (!kartlar.length || gorulen >= toplam) break;
  }
  return sonuc;
}

// BKM Kitap: /arama sayfası boş kabuk, sonuçlar sitenin kendi istemcisinin kullandığı Algolia indeksinden geliyor
// (herkese açık arama anahtarı bkmkitap.xyz/searchbkm.js içinde). Stok: in_stock alanı (sitede "Stokta yok" butonu bundan).
// Anahtar/indeks değişirse burası boş döner; o zaman searchbkm.js'ten yenisini almak gerekir.
async function bkm(q) {
  const j = await getir("https://G3KZ735F6S-dsn.algolia.net/1/indexes/bkmkitap_products/query", {
    json: true,
    method: "POST",
    headers: { "X-Algolia-Application-Id": "G3KZ735F6S", "X-Algolia-API-Key": "f19d4f1ec19fc607b496d59f306b719a", "Content-Type": "application/json" },
    // typoTolerance "min": tam eşleşme varsa "Dünyadan" gibi yazım-yakını çöpleri getirmez
    body: JSON.stringify({ query: q, hitsPerPage: 100, typoTolerance: "min", attributesToRetrieve: ["title", "url", "price", "in_stock"], attributesToHighlight: [] }),
  });
  return j.hits.map((x) => ({ baslik: coz(x.title), url: new URL(x.url, "https://www.bkmkitap.com").href, fiyat: tl(x.price), stok: x.in_stock !== false }));
}

// Kitapsepeti (T-Soft): sunucu tarafı liste, pg=N ile sayfalı. Stok: kartta "out-of-stock" (Tükendi) rozeti yoksa var.
async function kitapsepeti(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://www.kitapsepeti.com/arama?q=${encodeURIComponent(q)}${p > 1 ? `&pg=${p}` : ""}`);
    const kartlar = h.split(/class="[^"]*product-item effect-wrapper"/).slice(1);
    for (const b of kartlar) {
      const a = b.match(/href="([^"]+)" class="product-title[^"]*">([^<]*)/);
      if (!a) continue;
      sonuc.push({
        baslik: coz(a[2]).trim(),
        url: new URL(coz(a[1]), "https://www.kitapsepeti.com").href,
        fiyat: tl(bul(b, /class="product-price">([^<]*)/)),
        stok: !/class="out-of-stock/.test(b),
      });
    }
    const toplam = +bul(h, /Toplam <span[^>]*>(\d+)/) || 0;
    if (!kartlar.length || sonuc.length >= toplam) break;
  }
  return sonuc;
}

// Gerekli Şeyler (IdeaSoft): /arama?q= arama yapmıyor (detaylı arama formu döner); gerçek yol /arama/<sorgu>, 40'lı sayfa, ?tp=N.
// Stok: "no-stock-button" (Stokta Yok) / "sold-out-label" (Tükendi) yoksa var. Figür/İngilizce baskılar da gelir.
async function gerekli(q) {
  const sonuc = [];
  let url = `https://www.gerekliseyler.com.tr/arama/${encodeURIComponent(q)}`;
  for (let p = 1; url && p <= sayfaSiniri; p++) {
    const h = await getir(url);
    for (const b of h.split(/<div class="showcase">/).slice(1)) {
      const a = b.match(/class="showcase-title">\s*<a href="([^"]+)" title="([^"]*)"/);
      if (!a) continue;
      sonuc.push({
        baslik: coz(a[2]),
        url: new URL(coz(a[1]), "https://www.gerekliseyler.com.tr").href,
        fiyat: tl(bul(b, /showcase-price-new">([^<]*)/)),
        stok: !/no-stock-button|sold-out-label/.test(b) && /data-selector="add-to-cart"/.test(b),
      });
    }
    const sonraki = bul(h, /paginate-right paginate-active">\s*<a href="([^"]+)"/);
    url = sonraki && new URL(coz(sonraki), "https://www.gerekliseyler.com.tr").href;
  }
  return sonuc;
}

// Destek Dükkan: sunucu tarafı liste, &p=N. Stok: kartta "book outofstock" sınıfı yoksa var.
async function destek(q) {
  const sonuc = [];
  for (let p = 1; p <= sayfaSiniri; p++) {
    const h = await getir(`https://destekdukkan.com/arama?q=${encodeURIComponent(q)}${p > 1 ? `&p=${p}` : ""}`);
    for (const b of h.split(/<div class="book(?=[ "])/).slice(1)) {
      const a = b.match(/<a href="([^"]+)" class="title">\s*<h3>([\s\S]*?)<\/h3>/);
      if (!a) continue;
      sonuc.push({
        baslik: metin(a[2]),
        url: new URL(coz(a[1]), "https://destekdukkan.com").href,
        fiyat: tl(bul(b, /class="fiyat" data-price="([^"]*)"/)),
        stok: !/^\s*outofstock/.test(b) && /h-sepete-ekle/.test(b),
      });
    }
    if (!new RegExp(`[&;]p=${p + 1}"`).test(h)) break;
  }
  return sonuc;
}

export const MAGAZALAR = [
  magaza("kitapyurdu", "Kitapyurdu", kitapyurdu),
  magaza("dr", "D&R", dr),
  magaza("bkm", "BKM Kitap", bkm),
  magaza("kitapsepeti", "Kitapsepeti", kitapsepeti),
  magaza("gerekliseyler", "Gerekli Şeyler", gerekli),
  magaza("destekdukkan", "Destek Dükkan", destek),
];
