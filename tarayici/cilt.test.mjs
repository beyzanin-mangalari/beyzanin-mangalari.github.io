// node tarayici/cilt.test.mjs — başlıktan cilt numarası çıkarma kontrolü
import assert from "node:assert/strict";
import { ciltNo, yabanci, turkceCilt } from "./cilt.mjs";
assert.equal(ciltNo("Berserk Cilt 19", "Berserk"), 19);
assert.equal(ciltNo("Berserk 20", "Berserk"), 20);
assert.equal(ciltNo("Dandadan 8. Cilt", "Dandadan"), 8);
assert.equal(ciltNo("Mob Psycho 100 - 4", "Mob Psycho 100"), 4);
assert.equal(ciltNo("Hikaru'nun Veda Ettiği Yaz 8", "Hikaru'nun Veda Ettiği Yaz"), 8);
assert.equal(ciltNo("Titana Saldırı 5", "Titana Saldırı Çöküşten Önce"), null);
assert.equal(ciltNo("Berserk Ayraç", "Berserk"), null);
assert.ok(yabanci("Berserk Volume 42"));
assert.ok(yabanci("Sakamoto Days, Vol. 20"));
assert.ok(yabanci("Dandadan 20 (Jump Comics PLUS)"));
assert.ok(!yabanci("Dandadan 7. Cilt"));
assert.ok(!yabanci("Rooster Fighter 2 / Horoz Savaşçı"));
assert.ok(turkceCilt([{magaza:"a",baslik:"Gachiakuta Cilt 10"}]));
assert.ok(turkceCilt([{magaza:"a",baslik:"Berserk 20"},{magaza:"b",baslik:"Berserk 20"}]));
assert.ok(!turkceCilt([{magaza:"gerekliseyler",baslik:"Vinland Saga 14"}]));
console.log("cilt testleri geçti");
