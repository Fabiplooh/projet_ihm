// Partie client-side script moved from partie.html
(function(){
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  canvas.width = 800;
  canvas.height = 600;

  const ahBlink = {}; // userId -> timeUntil

  const menu = document.getElementById("menu");
  const joinBtn = document.getElementById("joinBtn");
  const partieInput = document.getElementById("partieId");
  const mapSelect = document.getElementById("mapSelect");
  const manageBtn = document.getElementById("manageBtn");
  const openLogin = document.getElementById("openLogin");
  const loginBox = document.getElementById("loginBox");
  const doLogin = document.getElementById("doLogin");
  const loginMsg = document.getElementById("loginMsg");
  const leaderboardDiv = document.getElementById("leaderboardList");

  openLogin.onclick = () => {
    loginBox.style.display =
      loginBox.style.display === "none" ? "block" : "none";
  };

  doLogin.onclick = async () => {
    const identifiant = document.getElementById("loginIdentifiant").value;
    const password = document.getElementById("loginPassword").value;

    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiant, password })
    });

    const data = await res.json();

    if (data.ok) {
      loginMsg.textContent = "Connecté !";
      loginMsg.style.color = "lime";
      //Pour recuperer le vrai userId
      socket.disconnect();
      socket.connect();

    } else {
      loginMsg.textContent = "Identifiants invalides";
      loginMsg.style.color = "red";
    }
  };

  manageBtn.addEventListener("click", () => {
    window.location.href = "/gestion-compte.html";
  });

  const socket = io();

  const keys = {
    left: false,
    right: false
  };

  let joueurs = {};
  let colliders =[];
  let exitZone = null;
  let joined =false;
  let joinAlertsDone=false;
  let leaderboard = [];

  let gameMasterId = null;
  let drawing = false;
  let path = [];
  let myId = null;

  //C'est pour voir si on est le game master ou non (affichage du trait de prévisualisation)  
  socket.on("your_id", id => myId = id);

  socket.on("leaderboard", data => {
    leaderboardDiv.innerHTML = "";

    data.leaderboard.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "leaderboard-row";

      if (p.userId === data.gameMaster) {
        div.classList.add("master");
      }

      div.innerHTML = `
        <span>${i+1}. ${p.pseudo}</span>
        <span>${p.score}</span>
      `;

      leaderboardDiv.appendChild(div);
    });
  });
  
  socket.on("connect", () => console.log("Socket.IO connecté", socket.id));
  socket.on("connect_error", (err) => console.error("Erreur connexion", err));

  socket.on("connection_first_on_server", () => {
    if (joinAlertsDone){
      return;
    }
    joinAlertsDone = true;
    alert("Tu es le premier sur ce salon !");
  });

  socket.on("connection_not_first", () => {
    if (joinAlertsDone){
      return;
    }
    joinAlertsDone = true;
    alert("Tu rejoins un salon déjà créer (ce ne sera peut être pas la même map que celle que tu as choisis)!");
  });

  socket.on("join_error", (msg) => {
    if (msg === "not_logged_in"){
      alert("Non connecté. Va te login.");
    }
    else {
      alert("Erreur join: " + msg);
    }
  });

  socket.on("state", (data) => {
    console.log("[CLIENT] État reçu:", data); 
    joueurs = data;
  });

  socket.on("map", (data) => { 
    colliders = data.colliders;
    exitZone = data.exit; 
    console.log("[CLIENT] Map reçue:", data);
  });

  socket.on("join_success", () => {
    console.log("[CLIENT] Join réussi !");
    menu.style.display = "none";
    canvas.style.display = "block";
    joined = true;

    const leaderBoard = document.getElementById("leaderboard");
    leaderBoard.style.display = "block";
  });

  socket.on("player_exit", () => {
    //alert("Vous avez atteint la sortie !");
  });

  joinBtn.addEventListener("click", async() => {
    const partieId = partieInput.value.trim();
    const mapId = mapSelect.value;

    if (!partieId) {
      alert("Entre un nom de partie");
      return;
    }

    socket.emit("join", { 
      partieId, 
      mapId, 
    });

  });
 
  socket.on("ah_ok", data => {
    // Le serveur a accepté le AH
    ahBlink[myId] = Date.now() + 200; // 200ms de clignotement
  });

  socket.on("ah_refuse", data => {
    console.log("AH en cooldown :", data.remaining, "ms");
  });

  socket.on("game_master", (id) => {
    gameMasterId = id;
    console.log("GM:", id);
  });
  

  document.addEventListener("mousedown", e => {
    drawing = true;
    path = [];
  });

  document.addEventListener("mouseup", e => {
    drawing = false;
    socket.emit("action_master", path);
  });

  document.addEventListener("mousemove", e => {
    if(!drawing || gameMasterId !== myId) return;
    const rectToServ = canvas.getBoundingClientRect();
    path.push({
      x: e.clientX - rectToServ.left,
      y: e.clientY - rectToServ.top
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (e.key === "ArrowLeft" && !keys.left) {
      keys.left = true;
      socket.emit("action", "left");
    }

    if (e.key === "ArrowRight" && !keys.right) {
      keys.right = true;
      socket.emit("action", "right");
    }

    if (e.key === "ArrowUp") {
      socket.emit("action", "jump");
    } 
    if (e.key === " "){
      socket.emit("action", "ah")
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") {
      keys.left = false;
      socket.emit("action", "stopLeft");
    }

    if (e.key === "ArrowRight") {
      keys.right = false;
      socket.emit("action", "stopRight");
    }
  });

  let drawnPlatforms = [];
  
  socket.on("full_reset", (data) => {
    // Vider toutes les données
    joueurs = {};
    drawnPlatforms = data.drawnPlatforms || [];
    path = [];
    colliders = data.map.colliders;
    exitZone = data.map.exit;
    
    // Mettre à jour le game master
    gameMasterId = data.gameMaster;
    
    // Clear le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });


  /*socket.on("reset", () => {
    console.log("RESET");

    joueurs = {};        // vider les joueurs
    drawnPlatforms = []; // vider les plateformes
    colliders = [];      // vider la map
    exitZone = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  socket.on("deleteDrawnPlatform", data => {
    path.length=0;
  });
  */
  socket.on("drawnPlatforms", data => {
    drawnPlatforms = data;
  });


  function loop() {
    console.log("[CLIENT] Loop appelée - joined:", joined);
    if (!joined) return requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const id in joueurs) {
      const p = joueurs[id];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      let color = p.colorPlayer || "blue";

      if (ahBlink[id] && Date.now() < ahBlink[id]) {
        // effet de clignotement
        color = "white";
      }

      ctx.fillStyle = color;

      ctx.fillRect(-20, -20, 40, 40);
      ctx.restore();
    }

    if (path.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.moveTo(path[0].x, path[0].y);
      for (let p of path) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.fillStyle = "#00b8ff";
    for (const p of drawnPlatforms) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(
        -p.width/2,
        -p.height/2,
        p.width,
        p.height
      );
      ctx.restore();
    }

    ctx.fillStyle = "grey";
    for (const c of colliders) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate((c.angle || 0) * Math.PI / 180);
          //ctx.rotate(c.angle || 0); // en radians, si serveur en degrés → c.angle * Math.PI / 180
          ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
          ctx.restore();
    }

    if (exitZone) {
      ctx.fillStyle = "lime";
      ctx.fillRect(
        exitZone.x - exitZone.width / 2,
        exitZone.y - exitZone.height / 2,
        exitZone.width,
        exitZone.height
      );
    }

    for (const id in joueurs) {
      const p = joueurs[id];
  
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      if (Number(id) === gameMasterId){
        ctx.strokeStyle ="gold";
        ctx.lineWidth = 2;
      }else{
        ctx.strokeStyle = "black";
      }
      ctx.strokeText(p.pseudoPlayer || "", 0, -24);
      ctx.fillStyle = "white";
      ctx.fillText(p.pseudoPlayer || "", 0, -24);
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }

  loop();
})();
