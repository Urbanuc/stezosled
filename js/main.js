// Izriše vrhove, rastline in živali iz podatki.js

const seznamVrhov = document.getElementById("seznam-vrhov");
vrhovi.forEach((vrh, i) => {
  const kartica = document.createElement("article");
  kartica.className = "kartica";
  kartica.innerHTML = `
    <div class="kartica-slika">${i + 1}</div>
    <div class="kartica-vsebina">
      <h3>${vrh.ime}</h3>
      <p class="visina">${vrh.visina} m</p>
      <p><strong>Izhodišče:</strong> ${vrh.izhodisce}</p>
      <p><strong>Čas hoje:</strong> ${vrh.cas}</p>
      <p><span class="oznaka ${vrh.tezavnost}">${vrh.tezavnost}</span></p>
      <p>${vrh.opis}</p>
    </div>`;
  seznamVrhov.appendChild(kartica);
});

function napolniSeznam(id, elementi) {
  const ul = document.getElementById(id);
  elementi.forEach((ime) => {
    const li = document.createElement("li");
    li.textContent = ime;
    ul.appendChild(li);
  });
}
napolniSeznam("seznam-rastlin", rastline);
napolniSeznam("seznam-zivali", zivali);

// Meni na telefonu
document.querySelector(".meni-gumb").addEventListener("click", () => {
  document.querySelector(".meni-povezave").classList.toggle("odprt");
});
