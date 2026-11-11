// Stran Rože: prepoznava rastlin (Pl@ntNet) in vodnik.
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

async function prepoznaj(datoteka) {
  const stanje = $("stanje");
  const rez = $("rezultati");
  rez.innerHTML = "";

  const predogled = await pomanjsajSliko(datoteka, 1000, 0.85);
  $("predogled").src = predogled;
  $("predogled").hidden = false;

  if (!plantnetKljuc) {
    stanje.className = "napaka";
    stanje.textContent = "Prepoznava še ni vklopljena: v datoteko js/config.js je treba vpisati brezplačen ključ Pl@ntNet.";
    return;
  }

  stanje.className = "majhno";
  stanje.textContent = "Prepoznavam …";
  try {
    const blob = await (await fetch(predogled)).blob();
    const podatki = new FormData();
    podatki.append("images", blob, "roza.jpg");
    podatki.append("organs", "auto");
    const odgovor = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?include-related-images=false&nb-results=5&api-key=${encodeURIComponent(plantnetKljuc)}`,
      { method: "POST", body: podatki },
    );
    if (!odgovor.ok) {
      throw new Error(odgovor.status === 404 ? "Rastline ni bilo mogoče prepoznati."
        : odgovor.status === 403 ? "Pl@ntNet ne dovoli te domene: v nastavitvah ključa na my.plantnet.org dodaj urbanuc.github.io med dovoljene domene."
          : "Napaka strežnika (" + odgovor.status + ").");
    }
    const json = await odgovor.json();
    const zadetki = (json.results || []).slice(0, 4);
    if (!zadetki.length) throw new Error("Rastline ni bilo mogoče prepoznati.");
    stanje.textContent = "Najverjetnejši zadetki:";
    rez.innerHTML = zadetki.map((z) => {
      const latinsko = z.species.scientificNameWithoutAuthor;
      const imena = (z.species.commonNames || []).slice(0, 3).join(", ");
      return `<div class="rezultat">
        <div class="rezultat-vrstica"><strong>${esc(imena || latinsko)}</strong><span>${Math.round(z.score * 100)} %</span></div>
        <div class="pasica"><div style="width:${Math.round(z.score * 100)}%"></div></div>
        <p class="majhno"><em>${esc(latinsko)}</em>${z.species.family ? " · družina " + esc(z.species.family.scientificNameWithoutAuthor) : ""}
          · <a href="https://sl.wikipedia.org/w/index.php?search=${encodeURIComponent(latinsko)}" target="_blank" rel="noopener">več</a></p>
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
