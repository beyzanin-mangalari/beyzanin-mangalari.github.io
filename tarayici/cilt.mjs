// başlık sadeleştirme ve cilt numarası çıkarma
export const sade = s => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();

// başlıkta seri adından sonra gelen kısımdan cilt numarasını bulur; bulamazsa null
export function ciltNo(baslik, sorgu) {
  const b = sade(baslik), q = sade(sorgu);
  const i = b.indexOf(q);
  if (i < 0) return null;
  const kalan = b.slice(i + q.length);
  const m = kalan.match(/(?:^|\s)(?:cilt|sayi|vol|volume|no)\s*(\d{1,3})\b/) || kalan.match(/^\s*(\d{1,3})\b/) || kalan.match(/\b(\d{1,3})\s*cilt\b/);
  return m ? +m[1] : null;
}

// ithal (İngilizce/Japonca) baskılar: "Vol. 3", "Volume 42", "(Jump Comics PLUS)", "Deluxe" ...
export const yabanci = baslik => /\bvol(ume)?\b|\((?=[^)]*\b(comics|kc|magazine|edition)\b)[^)]*\)|\bdeluxe\b|\bomnibus\b|\bbox set\b|\bhardcover\b|[\u3040-\u30ff\u4e00-\u9fff]/i.test(baslik);

// Türkçe baskı sayılır: başlıkta "cilt" geçiyorsa ya da en az iki farklı mağazada satılıyorsa
export const turkceCilt = ilanlar => ilanlar.some(x => /\bcilt\b/i.test(x.baslik)) || new Set(ilanlar.map(x => x.magaza)).size >= 2;
