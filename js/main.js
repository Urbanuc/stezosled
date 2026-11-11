// Stranski seznam dvatisočakov in izbira vrha v obrazcu.
const seznamVrhovUl = document.getElementById("seznam-vrhov");
vrhovi.forEach((v, i) => {
  const li = document.createElement("li");
  li.className = v.opravljeno ? "opravljen" : "";
  li.innerHTML = `<span class="stevilka">${i + 1}</span>
    <span><strong>${v.ime}</strong>${v.visina ? `<br><span class="majhno">${v.visina} m · ${v.izhodisce}</span>` : ""}</span>
    <span class="kljukica">${v.opravljeno ? "✔" : ""}</span>`;
  seznamVrhovUl.appendChild(li);
});

const izbiraVrhov = document.getElementById("seznam-vrhov-izbira");
vrhovi.filter((v) => v.visina).forEach((v) => {
  const o = document.createElement("option");
  o.value = v.ime;
  izbiraVrhov.appendChild(o);
});

document.getElementById("objava-slika").addEventListener("change", (e) => {
  const f = e.target.files[0];
  document.getElementById("izbrana-slika").textContent = f ? "Izbrana slika: " + f.name : "";
});
