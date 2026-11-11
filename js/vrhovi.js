// Stran Vrhovi: iskanje, filtri in »bil sem tu«.
import * as skupno from "./skupno.js";
import { db, $, esc, onUporabnik, odpriPrijavo } from "./skupno.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { vrhovi } from "./podatki.js";

let obiski = []; // {uid, vrh}
const stevilo = (id) => obiski.filter((o) => o.vrh === id).length;
const bil = (id) => skupno.uporabnik && obiski.some((o) => o.vrh === id && o.uid === skupno.uporabnik.uid);

[...new Set(vrhovi.map((v) => v.gorovje))].forEach((g) => {
  const o = document.createElement("option");
  o.textContent = g;
  $("filter-gorovje").appendChild(o);
});

function izrisi() {
  const iskanje = $("iskanje").value.trim().toLowerCase();
  const gorovje = $("filter-gorovje").value;
  const tezavnost = $("filter-tezavnost").value;
  const razvrsti = $("razvrsti").value;

  const seznam = vrhovi
    .filter((v) => v.ime.toLowerCase().includes(iskanje))
    .filter((v) => !gorovje || v.gorovje === gorovje)
    .filter((v) => !tezavnost || v.tezavnost === tezavnost)
    .sort((a, b) =>
      razvrsti === "ime" ? a.ime.localeCompare(b.ime, "sl")
        : razvrsti === "obiski" ? stevilo(b.id) - stevilo(a.id)
          : b.visina - a.visina);

  const el = $("seznam-vrhov");
  el.innerHTML = seznam.length ? "" : '<p class="majhno">Ni zadetkov.</p>';
  seznam.forEach((v) => {
    const k = document.createElement("article");
    k.className = "kartica vrh-kartica";
    k.innerHTML = `
      <div class="vrh-visina">${v.visina} m</div>
      <h3>${esc(v.ime)}</h3>
      <p class="majhno">${esc(v.gorovje)}</p>
      <p><span class="oznaka ${v.tezavnost.replace(/ /g, "-")}">${esc(v.tezavnost)}</span></p>
      <p>${esc(v.opis)}</p>
      <div class="vrh-noga">
        <button class="gumb ${bil(v.id) ? "" : "gumb-svetel"}" data-vrh="${v.id}">${bil(v.id) ? "✔ Bil sem tu" : "Bil sem tu"}</button>
        <span class="majhno">${stevilo(v.id)} ${stevilo(v.id) === 1 ? "obiskovalec" : "obiskovalcev"}</span>
      </div>`;
    el.appendChild(k);
  });
}

["iskanje", "filter-gorovje", "filter-tezavnost", "razvrsti"].forEach((id) =>
  $(id).addEventListener("input", izrisi));

$("seznam-vrhov").addEventListener("click", async (e) => {
  const gumb = e.target.closest("button[data-vrh]");
  if (!gumb) return;
  const u = skupno.uporabnik;
  if (!u) return odpriPrijavo();
  const id = gumb.dataset.vrh;
  const ref = doc(db, "obiski", `${u.uid}_${id}`);
  try {
    if (bil(id)) await deleteDoc(ref);
    else await setDoc(ref, { uid: u.uid, vrh: id, cas: serverTimestamp() });
  } catch (err) {
    $("sporocilo").textContent = "Napaka: " + err.message;
    $("sporocilo").className = "napaka";
  }
});

onSnapshot(collection(db, "obiski"), (snap) => {
  obiski = snap.docs.map((d) => d.data());
  izrisi();
}, () => izrisi());
onUporabnik(izrisi);
izrisi();
