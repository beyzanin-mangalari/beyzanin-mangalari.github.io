// Kullanım: node tarayici/dene.mjs "Vinland Saga"   (varsayılan: Berserk)
import { MAGAZALAR } from "./magazalar.mjs";

const sorgu = process.argv.slice(2).join(" ") || "Berserk";
console.log(`Sorgu: ${sorgu}\n`);

const sonuclar = await Promise.all(MAGAZALAR.map(async (m) => {
  const t0 = Date.now();
  return { m, r: await m.ara(sorgu), sn: ((Date.now() - t0) / 1000).toFixed(1) };
}));

let hata = 0;
for (const { m, r, sn } of sonuclar) {
  console.log(`== ${m.ad} (${m.id}): ${r.length} sonuç, ${r.filter((x) => x.stok).length} stokta, ${sn}s`);
  for (const x of r.slice(0, 5)) {
    console.log(`   ${x.stok ? "VAR " : "YOK "} ${x.fiyat == null ? "   -   " : x.fiyat.toFixed(2).padStart(8)} TL  ${x.baslik}  ${x.url}`);
    // Basit şekil kontrolü: parser bozulursa burada patlasın
    if (!x.baslik || !/^https:\/\//.test(x.url) || (x.fiyat !== null && !(x.fiyat > 0)) || typeof x.stok !== "boolean") hata++;
  }
  console.log();
}
if (hata) { console.error(`${hata} hatalı kayıt`); process.exitCode = 1; }
