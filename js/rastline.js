// Stran Rože: prepoznava rastlin (Pl@ntNet) s slovenskimi imeni in vodnik.
import "./skupno.js";
import { $, esc, pomanjsajSliko } from "./skupno.js";
import { rastline } from "./podatki.js";
import { plantnetKljuc } from "./config.js";

$("vodnik").innerHTML = rastline.map((r) => `
  <article class="kartica">
    <h3>${esc(r.ime)}</h3>
    <p class="majhno"><em>${esc(r.latinsko)}</em></p>
    <p>${esc(r.opis)}</p>
  </article>`).join("");

// ---------- Pl@ntNet ----------
// Najprej flora zahodne Evrope (vključuje Alpe), če ta projekt odpove, pa vse rastline.
async function pozoviPlantNet(blob) {
  const projekti = ["weurope", "all"];
  let zadnji = null;
  for (const projekt of projekti) {
    const podatki = new FormData();
    podatki.append("images", blob, "roza.jpg");
    podatki.append("organs", $("del-rastline").value);
    const odgovor = await fetch(
      `https://my-api.plantnet.org/v2/identify/${projekt}?include-related-images=false&nb-results=6&api-key=${encodeURIComponent(plantnetKljuc)}`,
      { method: "POST", body: podatki },
    );
    if (odgovor.ok) {
      const json = await odgovor.json();
      if (json.results?.length) return json.results;
    }
    zadnji = odgovor;
    if (odgovor.status === 403 || odgovor.status === 429) break;
  }
  const status = zadnji?.status;
  if (status === 403) throw new Error("Pl@ntNet ne dovoli te domene: v nastavitvah ključa na my.plantnet.org dodaj https://urbanuc.github.io med dovoljene domene.");
  if (status === 429) throw new Error("Presežena dnevna omejitev prepoznav, poskusi jutri.");
  throw new Error("Rastline ni bilo mogoče prepoznati.");
}

// ---------- Slovenska imena (Wikidata) ----------
const sklad = new Map(rastline.map((r) => [r.latinsko.toLowerCase(), r.ime]));

async function slovenskaImena(latinska) {
  const imena = new Map();
  latinska.forEach((l) => { if (sklad.has(l.toLowerCase())) imena.set(l, sklad.get(l.toLowerCase())); });
  const manjkajo = latinska.filter((l) => !imena.has(l));
  if (!manjkajo.length) return imena;

  const vrednosti = manjkajo.map((l) => `"${l.replace(/"/g, "")}"`).join(" ");
  const sparql = `
    SELECT ?lat ?ljudsko ?clanek ?oznaka WHERE {
      VALUES ?lat { ${vrednosti} }
      ?t wdt:P225 ?lat.
      OPTIONAL { ?t wdt:P1843 ?ljudsko. FILTER(LANG(?ljudsko) = "sl") }
      OPTIONAL { ?a schema:about ?t; schema:isPartOf <https://sl.wikipedia.org/>; schema:name ?clanek. }
      OPTIONAL { ?t rdfs:label ?oznaka. FILTER(LANG(?oznaka) = "sl") }
    }`;
  try {
    const odgovor = await fetch(
      "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql),
      { headers: { Accept: "application/sparql-results+json" } },
    );
    if (!odgovor.ok) return imena;
    const json = await odgovor.json();
    const velika = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    for (const vrstica of json.results.bindings) {
      const lat = vrstica.lat.value;
      if (imena.has(lat)) continue;
      const kandidati = [
        vrstica.ljudsko?.value,
        vrstica.clanek?.value.replace(/\s*\(.*?\)\s*$/, ""),
        vrstica.oznaka?.value,
      ].filter((k) => k && k.toLowerCase() !== lat.toLowerCase());
      if (kandidati.length) imena.set(lat, velika(kandidati[0]));
    }
  } catch {
    // brez slovenskega imena pokažemo latinsko
  }
  return imena;
}

async function prepoznaj(datoteka) {
  const stanje = $("stanje");
  const rez = $("rezultati");
  rez.innerHTML = "";

  const predogled = await pomanjsajSliko(datoteka, 1000, 0.85);
  $("predogled").src = predogled;
  $("predogled").hidden = false;

  if (!plantnetKljuc) {
    stanje.className = "napaka";
    stanje.textContent = "Prepoznava še ni vklopljena: v datoteko js/config.js je treba vpisati ključ Pl@ntNet.";
    return;
  }

  stanje.className = "majhno";
  stanje.textContent = "Prepoznavam …";
  try {
    const blob = await (await fetch(predogled)).blob();
    const zadetki = (await pozoviPlantNet(blob)).slice(0, 4);
    const latinska = zadetki.map((z) => z.species.scientificNameWithoutAuthor);
    const imena = await slovenskaImena(latinska);

    stanje.textContent = "Najverjetnejši zadetki:";
    rez.innerHTML = zadetki.map((z, i) => {
      const lat = latinska[i];
      const odstotek = Math.round(z.score * 100);
      return `<div class="rezultat">
        <div class="rezultat-vrstica"><strong>${esc(imena.get(lat) || lat)}</strong><span>${odstotek} %</span></div>
        <div class="pasica"><div style="width:${odstotek}%"></div></div>
        <p class="majhno"><a href="https://sl.wikipedia.org/w/index.php?search=${encodeURIComponent(imena.get(lat) || lat)}" target="_blank" rel="noopener">več o tej rastlini</a></p>
      </div>`;
    }).join("");
  } catch (err) {
    stanje.className = "napaka";
    stanje.textContent = err.message;
  }
}

["slika-kamera", "slika-galerija"].forEach((id) =>
  $(id).addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) prepoznaj(f);
    e.target.value = "";
  }));
