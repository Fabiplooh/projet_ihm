(() => {

const partieInput = document.getElementById("partieId");
const creerPartieBtn = document.getElementById("creerPartieBtn");
const manageBtn = document.getElementById("manageBtn");

manageBtn.onclick = async () => {
  window.location.href = "/gestion-compte.html";
};

creerPartieBtn.addEventListener("click", async() => {
  const partieId = partieInput.value.trim();
  const mapId = mapSelect.value;

  if (!partieId) {
    alert("Entre un nom de partie");
    return;
  }

  window.location.href = `/partie.html?idPartie=${partieId}&mapId=${mapId}`;
});

async function chargerParties() {
  try {
    const response = await fetch("/parties");
    const parties = await response.json();

    partiesHTML = document.getElementById('partiesEnCours')
    partiesHTML.innerHTML += parties.map(p =>
                                              `<tr>
                                                <td>${p.id}</td>
                                                <td>${p.nom}</td>
                                                <td>${p.nbJoueurs}</td>
                                                <td><button class="join-btn" data-id="${p.id}">Rejoindre</button></td>
                                              </tr>`
    ).join("");
    
    partiesHTML.addEventListener("click", function (e) {
      if (e.target.classList.contains("join-btn")) {
        const id = e.target.dataset.id;
        window.location.href = `/partie.html?idPartie=${id}`;
      }
    });
  } catch (error) {
    console.error(error);
  }
}

chargerParties();

})();
