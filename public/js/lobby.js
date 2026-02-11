(() => {
  
async function chargerParties() {
  try {
    const response = await fetch("/parties");
    const parties = await response.json();

    partiesHTML = document.getElementById('partiesEnCours')
    partiesHTML.innerHTML += parties.map(p => `<tr><td>${p.id}</td><td>${p.nom}</td><td>${p.nbJoueurs}</td><td><button onclick="joinPartie('${p.id}')">Rejoindre</button></td></tr>`).join("");

    parties.forEach(p => {
      console.log(p.id, p.nbJoueurs);
      });

  } catch (error) {
    console.error(error);
  }
}

chargerParties();

const backBtn = document.getElementById("manageBtn");
  backBtn.onclick = async () => {
    window.location.href = "/gestion-compte.html";
  };
  /*const canvas = document.getElementById("partie1");
  const ctx = canvas.getContext("2d");
  canvas.width = 800;
  canvas.height = 600;*/

  /*const socket = io();

  socket.on("connect", () => console.log("Socket.IO connecté", socket.id));
  socket.on("connect_error", (err) => console.error("Erreur connexion", err));

    socket.emit("lobby", { 

        });

    socket.on("lobby_success", () => console.log("Connecté au lobby !", socket.id))*/

})();
