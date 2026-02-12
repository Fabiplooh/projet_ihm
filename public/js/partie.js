// Partie client-side script moved from partie.html
(function(){
  // Récupération du paramètre en entrée de l'URL ()
  const urlParams = new URLSearchParams(window.location.search);
  const idPartie = urlParams.get('idPartie');
  const mapId = urlParams.get('mapId');

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  
  const SERVER_WIDTH = 800;
  const SERVER_HEIGHT = 600;
  canvas.width = SERVER_WIDTH;
  canvas.height = SERVER_HEIGHT;

  // REDIMENSIONNEMENT pour les différents écrans
  function resizeCanvas() {
    const maxWidth = window.innerWidth - 20; //Calcul la taille max de l'ecran
    const maxHeight = window.innerHeight - 100; // espace pour contrôles et menu
    
    const scale = Math.min(maxWidth / SERVER_WIDTH, maxHeight / SERVER_HEIGHT, 1);
    
    canvas.style.width = (SERVER_WIDTH * scale) + "px";
    canvas.style.height = (SERVER_HEIGHT * scale) + "px";
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);


  const ahBlink = {}; // userId -> timeUntil
  const leaderboardDiv = document.getElementById("leaderboardList");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const ahBtn = document.getElementById("ahBtn");
   const socket = io();


  window.onload = (event) => {
    if(idPartie !==null && idPartie !== undefined){
      if (mapId == undefined)
        joinPartie(idPartie, null);
      else
        joinPartie(idPartie, mapId);
    } else {
      window.location.href = "/lobby.html";
    }
  };

  function joinPartie(partieId, mapId) {
    socket.emit("join", { 
      partieId, 
      mapId 
    });
  }

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
    alert("Le nom de partie que tu as choisi existe déjà... Te voilà donc catapulté dans cette partie ! ;)");
  });

  socket.on("join_error", (msg) => {
    if (msg === "not_logged_in"){
      alert("Non connecté. Va te login.");
    }
    else {
      alert("Erreur join: " + msg);
    }
  });

  backBtn.addEventListener("click", () => {
    window.location.href = "/lobby.html";
  });

  const keys = {
    left: false,
    right: false
  };

  var touchDevice = ('ontouchstart' in document.documentElement);
  if (touchDevice){
    document.getElementById("mobileControls").style.display = "flex";
  }

  //document.getElementById("mobileControls").style.display = "flex";
  leftBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    socket.emit("action", "left");
  });
  leftBtn.addEventListener("touchend", e => {
    e.preventDefault();
    socket.emit("action", "stopLeft");
  });
  /*leftBtn.addEventListener("mousedown", e => {
    e.preventDefault();
    socket.emit("action", "left");
  });
  leftBtn.addEventListener("mouseup", e => {
    e.preventDefault();
    socket.emit("action", "stopLeft");
  });
  leftBtn.addEventListener("mouseleave", e => {
    if (e.buttons === 1) {
      socket.emit("action", "stopLeft");
    }
  });*/

  rightBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    socket.emit("action", "right");
  });
  rightBtn.addEventListener("touchend", e => {
    e.preventDefault();
    socket.emit("action", "stopRight");
  });
  /*rightBtn.addEventListener("mousedown", e => {
    e.preventDefault();
    socket.emit("action", "right");
  });
  rightBtn.addEventListener("mouseup", e => {
    e.preventDefault();
    socket.emit("action", "stopRight");
  });
  rightBtn.addEventListener("mouseleave", e => {
    if (e.buttons === 1) {
      socket.emit("action", "stopRight");
    }
  });*/

  jumpBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    socket.emit("action", "jump");
  });
  /*jumpBtn.addEventListener("mousedown", e => {
    e.preventDefault();
    socket.emit("action", "jump");
  });*/

  ahBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    socket.emit("action", "ah");
  });
  /*ahBtn.addEventListener("mousedown", e => {
    e.preventDefault();
    socket.emit("action", "ah");
  });*/


  let joueurs = {};
  let colliders =[];
  let exitZone = null;
  let joined =false;
  let joinAlertsDone=false;
  let leaderboard = [];

  let playerSize = 40;
  let gameMasterId = null;
  let drawing = false;
  let path = [];
  let myId = null;

  //C'est pour voir si on est le game master ou non (affichage du trait de prévisualisation)  
  socket.on("your_id", id => myId = id);

  socket.on("playerSize", data => {
    playerSize = data
  });
  
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
    canvas.style.display = "block";
    joined = true;
    
    const leaderBoard = document.getElementById("leaderboard");
    leaderBoard.style.display = "block";

    //Pour recuperer le vrai userId
    //socket.disconnect();
    //socket.connect();
  
  });

  socket.on("player_exit", () => {
    //alert("Vous avez atteint la sortie !");
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
    path = [] 
  });

  document.addEventListener("mousemove", e => {
    if(!drawing || gameMasterId !== myId) return;
    const rectToServ = canvas.getBoundingClientRect();
    path.push({
      x: e.clientX - rectToServ.left,
      y: e.clientY - rectToServ.top
    });
  });

  //Pour les mobiles:  
  canvas.addEventListener("touchstart", e => {
    if(gameMasterId !== myId) return;
    e.preventDefault();
    drawing = true;
    path = [];
  });

  canvas.addEventListener("touchend", e => {
    if(gameMasterId !== myId) return;
    e.preventDefault();
    drawing = false;
    socket.emit("action_master", path);
    path = [];
  });

  canvas.addEventListener("touchmove", e => {
    if(!drawing || gameMasterId !== myId) return;
    e.preventDefault();
    const rectToServ = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    // Position relative dans le canvas visible
    const relX = touch.clientX - rectToServ.left;
    const relY = touch.clientY - rectToServ.top;
    
    // Conversion vers coordonnées serveur (800x600)
    const x = (relX / rectToServ.width) * SERVER_WIDTH;
    const y = (relY / rectToServ.height) * SERVER_HEIGHT;  
    path.push({ x, y });
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

    const half = playerSize / 2;
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

      ctx.fillRect(-half, -half, playerSize, playerSize);
      ctx.restore();
    }

    //Previsualisation du dessin
    if (path.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.moveTo(path[0].x, path[0].y);
      for (let p of path) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    //dessin des platformes dynamique (gameMaster)
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

    //Dessin des platformes de la map de base
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
