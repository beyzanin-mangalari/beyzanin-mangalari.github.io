// node tarayici/cilt.test.mjs — başlıktan cilt numarası çıkarma kontrolü
import assert from "node:assert/strict";
import { ciltNo, yabanci, turkceCilt, kesinCilt, urunSayfasi } from "./cilt.mjs";
assert.equal(ciltNo("Berserk Cilt 19", "Berserk"), 19);
assert.equal(ciltNo("Berserk 20", "Berserk"), 20);
assert.equal(ciltNo("Dandadan 8. Cilt", "Dandadan"), 8);
assert.equal(ciltNo("Mob Psycho 100 - 4", "Mob Psycho 100"), 4);
assert.equal(ciltNo("Mob Psycho 100 (3. Cilt)", "Mob Psycho 100"), 3);
assert.equal(ciltNo("Hikaru'nun Veda Ettiği Yaz 8", "Hikaru'nun Veda Ettiği Yaz"), 8);
assert.equal(ciltNo("Rooster Fighter Cilt 2 - Horoz Savaşçı", "Rooster Fighter"), 2);
assert.equal(ciltNo("Titana Saldırı 5", "Titana Saldırı Çöküşten Önce"), null);
assert.equal(ciltNo("Berserk Ayraç", "Berserk"), null);
// yanlış pozitifler (07.10.2026 denetimi)
// dergi: "Kaiju No.8" sayısı Sakamoto Days 8. cilt sanılıyordu
assert.equal(ciltNo("Saikyo Jump October 2025 Issue [Cover] Sakamoto Holidays w Sakamoto Days & Kaiju No.8 B3 Poster and More", "Sakamoto Days"), null);
// seri adıyla sayı arasında başka kelime: farklı seri / alt başlık
assert.equal(ciltNo("Berserk of Gluttony 3. Cilt", "Berserk"), null);
assert.equal(ciltNo("Titana Saldırı - Kayıp Kızlar Cilt 1", "Titana Saldırı"), null);
assert.equal(ciltNo("Sakamoto Days - Sakamoto Günleri 6", "Sakamoto Günleri"), 6);
assert.equal(ciltNo("Vinland Saga - Vinland Destanı 10. Cilt", "Vinland Destanı"), 10);
// novel ve kutu seti cilt değil (Titana Saldırı: Çöküşten Önce)
assert.equal(ciltNo("Titana Saldırı - Çöküşten Önce Cilt 1 Novel", "Titana Saldırı: Çöküşten Önce"), null);
assert.equal(ciltNo("Titana Saldırı / Çöküşten Önce Cilt 2 - Novel", "Titana Saldırı Çöküşten Önce"), null);
assert.equal(ciltNo("Titana Saldırı - Çöküşten Önce 1 - 5 - Poster Hediyeli Manga Set", "Titana Saldırı: Çöküşten Önce"), null);
// çift cilt baskı: son cilt; sadece adet yazan "2 Cilt Bir Arada" belirsiz
assert.equal(ciltNo("Teogonia 1. Cilt - 2. Cilt (İki Cilt Bir Arada)", "Teogonia"), 2);
assert.equal(ciltNo("Teogonia (3. Cilt - 4. Cilt)", "Teogonia"), 4);
assert.equal(ciltNo("Teogonia - Cilt 3 - Cilt 4 - 2 Kitap Bir Arada", "Teogonia"), 4);
assert.equal(ciltNo("Teogonia (2. Cilt Birarada)", "Teogonia"), null);
assert.equal(ciltNo("Teogonia - 2 Cilt Bir Arada", "Teogonia"), null);
assert.ok(yabanci("Berserk Volume 42"));
assert.ok(yabanci("Sakamoto Days, Vol. 20"));
assert.ok(yabanci("Dandadan 20 (Jump Comics PLUS)"));
assert.ok(!yabanci("Dandadan 7. Cilt"));
assert.ok(!yabanci("Rooster Fighter 2 / Horoz Savaşçı"));
// düz başlıklı ithal baskı: yayınevi / dil / kategori alanından yakalanır
assert.ok(yabanci("Gachiakuta 10", { yayinci: "Kodansha" }));
assert.ok(yabanci("Vinland Saga 11", { yayinci: "Kodansha" }));
assert.ok(!yabanci("Gachiakuta Cilt 10", { yayinci: "Athica Yayınları" }));
assert.ok(yabanci("Dandadan 3", { dil: "İngilizce" }));
assert.ok(!yabanci("Hikaru'nun Veda Ettiği Yaz Cilt 8", { dil: "Türkçe" }));
assert.ok(yabanci("Titana Saldırı - Çöküşten Önce 1", { kategori: "Edebiyat Kitapları, Bilim Kurgu Romanları" }));
assert.ok(!yabanci("Titana Saldırı - Çöküşten Önce 1", { kategori: "Edebiyat Kitapları, Çizgi Roman Kitapları" }));
assert.ok(turkceCilt([{magaza:"a",baslik:"Gachiakuta Cilt 10"}]));
assert.ok(turkceCilt([{magaza:"a",baslik:"Berserk 20"},{magaza:"b",baslik:"Berserk 20"}]));
assert.ok(!turkceCilt([{magaza:"gerekliseyler",baslik:"Vinland Saga 14"}]));
// yeni cilt için iki mağazada stok şart: tek mağaza ya da stoksuz ilan "Yeni: 20. cilt" yaratamaz
assert.ok(!kesinCilt([{magaza:"dr",baslik:"Berserk 20",stok:true}]));
assert.ok(!kesinCilt([{magaza:"dr",baslik:"Berserk 20",stok:true},{magaza:"bkm",baslik:"Berserk 20",stok:false}]));
assert.ok(kesinCilt([{magaza:"dr",baslik:"Berserk 20",stok:true},{magaza:"bkm",baslik:"Berserk 20",stok:true}]));
// ana sayfa / arama linki ürün değil (önizleme verisindeki "Berserk 20" → https://www.dr.com.tr/)
assert.ok(!urunSayfasi("https://www.dr.com.tr/"));
assert.ok(!urunSayfasi("https://www.dr.com.tr"));
assert.ok(!urunSayfasi("https://www.dr.com.tr/search?q=Berserk"));
assert.ok(!urunSayfasi("https://www.gerekliseyler.com.tr/arama/Berserk"));
assert.ok(urunSayfasi("https://www.dr.com.tr/kitap/berserk-19/kentaro-miura/manga/urunno=0002242314001"));
console.log("cilt testleri geçti");
