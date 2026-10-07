// başlık sadeleştirme ve cilt numarası çıkarma
export const sade = s => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();

// Cilt olmayan ürünler: kutu seti, novel, ayraç, poster, figür... (kelime seri adının kendisinde geçiyorsa sayılmaz)
const URUN_DISI = /\b(set|seti|kutu|box|ayrac|kartpostal|poster|artbook|art book|figur|figure|novel|rozet|takvim|defter|boyama|sticker)\b/g;

// Cilt numarası seri adının HEMEN arkasında olmalı ("Berserk 20", "Berserk Cilt 20", "Dandadan 7. Cilt").
// Arada başka kelime varsa farklı seri/dergi/yan hikâyedir ("Berserk of Gluttony 3. Cilt", "... Sakamoto Days & Kaiju No.8");
// alt başlıklı baskılar ("Sakamoto Days - Sakamoto Günleri 6") için mangalar.json'da `ara` ile alt başlık verilir.
// Çift cilt baskı ("Teogonia 3. Cilt - 4. Cilt") son cildi döner; "2 Cilt Bir Arada" gibi sadece adet yazanlar null.
export function ciltNo(baslik, sorgu) {
  const b = sade(baslik), q = sade(sorgu);
  const i = b.indexOf(q);
  if (i < 0) return null;
  const qKelime = q.split(" ");
  if ([...b.matchAll(URUN_DISI)].some(m => !qKelime.includes(m[1]))) return null;
  const kalan = b.slice(i + q.length);
  const m = kalan.match(/^\s*(?:(?:cilt|sayi|vol|volume|no)\s*)?(\d{1,3})\b/);
  if (!m) return null;
  const ciltler = [...kalan.matchAll(/(\d{1,3})\s*cilt\b|\bcilt\s*(\d{1,3})\b/g)].map(x => +(x[1] ?? x[2]));
  if (ciltler.length >= 2) return Math.max(...ciltler);
  if (/\bbir\s*arada\b/.test(kalan)) return null;
  return +m[1];
}

// Türkçe baskıyı yazmayan yabancı yayınevleri/üreticiler (Gerekli Şeyler ithal kitapları "Gachiakuta 10" gibi düz başlıkla satıyor)
const YABANCI_YAYINEVI = /kodansha|viz media|yen press|shueisha|shogakukan|kadokawa|square enix|seven seas|dark horse|udon|tokyopop|vertical|hakusensha|akita shoten|futabasha|ichijinsha|mag garden|j-novel|denpa|ghost ship|titan comics|image comics|marvel|dc comics|panini|gl[eé]nat|carlsen|banpresto|sega|bandai|good smile|taito|furyu|kotobukiya/i;

// Türkçe manga cildi olmayan ilan: ithal baskı (başlık kalıbı, yabancı yayınevi, D&R dil alanı) ya da roman (BKM kategorisi)
export const yabanci = (baslik, { yayinci = "", dil = "", kategori = "" } = {}) =>
  /\bvol(ume)?\b|\((?=[^)]*\b(comics|kc|magazine|edition)\b)[^)]*\)|\bdeluxe\b|\bomnibus\b|\bbox set\b|\bhardcover\b|[぀-ヿ一-鿿]/i.test(baslik)
  || YABANCI_YAYINEVI.test(yayinci) || (!!dil && !/^t[uü]rk[cç]e$/i.test(dil.trim())) || /(?<!çizgi )roman/i.test(kategori);

// Ana sayfa / arama sayfasına giden link ürün değildir
export const urunSayfasi = url => { try { return !/^\/?$|^\/(arama|search)\b/i.test(new URL(url).pathname); } catch { return false; } };

// Türkçe baskı sayılır: başlıkta "cilt" geçiyorsa ya da en az iki farklı mağazada satılıyorsa
export const turkceCilt = ilanlar => ilanlar.some(x => /\bcilt\b/i.test(x.baslik)) || new Set(ilanlar.map(x => x.magaza)).size >= 2;

// Yeni cilt kanıtı: en az iki farklı mağazada stokta (tek mağaza / ön sipariş / tükenmiş ilan "yeni cilt" yaratamaz)
export const kesinCilt = ilanlar => new Set(ilanlar.filter(x => x.stok).map(x => x.magaza)).size >= 2;
