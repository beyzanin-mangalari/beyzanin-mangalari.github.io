// Kullanım: node magazalar-ek-dene.mjs "Dandadan" [magazaId ...]
// Ek mağazaları + karşılaştırma için Destek Dükkan / Gerekli Şeyler'i (magazalar.mjs, salt okunur) dener.
import { EK_MAGAZALAR } from "./magazalar-ek.mjs";
import { MAGAZALAR } from "./magazalar.mjs";

const [sorgu = "Dandadan", ...secim] = process.argv.slice(2);
const liste = [...EK_MAGAZALAR, ...MAGAZALAR.filter((m) => ["destekdukkan", "gerekliseyler"].includes(m.id))]
  .filter((m) => !secim.length || secim.includes(m.id));

for (const m of liste) {
  const t = Date.now();
  const r = await m.ara(sorgu);
  console.log(`\n== ${m.ad} (${m.id}): ${r.length} sonuç, ${r.filter((x) => x.stok).length} stokta, ${Date.now() - t} ms`);
  for (const x of r.slice(0, 5)) console.log(`  ${x.stok ? "VAR " : "YOK "} ${String(x.fiyat ?? "-").padStart(8)}  ${x.baslik}  ${x.url}`);
}
