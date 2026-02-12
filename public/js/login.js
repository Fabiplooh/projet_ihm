(() => {
  //const socket = io();

  // Fonction pour que les boites de résultats soient invisible au début, et apparaissent que lorsque l'on a un resultat
  function showResult(elementId, message, isSuccess = true) {
    document.querySelectorAll('.result').forEach(elem => {
      elem.classList.remove('visible', 'error');
      const text = elem.querySelector('.result-text');
      if (text) text.textContent = '';
      const actions = elem.querySelector('.result-actions');
      if (actions) actions.style.display = 'none';
    });

    const element = document.getElementById(elementId);
    const textElem = element.querySelector('.result-text') || element;
    textElem.textContent = message;
    if (isSuccess){
      element.className = 'result visible';
    } else {
      element.className = 'result error visible';
    }
    const actions = element.querySelector('.result-actions');
    if (actions) {
      actions.style.display = isSuccess ? '' : 'none';
      actions.classList.toggle('visible', !!isSuccess);
    }
  }

  const api = (url, data) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());

  
  // Ajout d'un boutton "Rejoindre la partie" dans la div d'inscription
  const btnJoinGame = document.createElement("button");
  btnJoinGame.id = "btn_joinGame"
  btnJoinGame.className = "greenBtn";
  btnJoinGame.appendChild(document.createTextNode("C'est parti !"));
  btnJoinGame.addEventListener("click", () => {
    window.location.href = "/lobby";
  });

  const regActions = document.getElementById("regActions");
  if (regActions) regActions.appendChild(btnJoinGame);
  

  document.getElementById('btnLogin').onclick = async () => {
    const identifiant = document.getElementById('identifiant').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!identifiant || !password){
      showResult('loginResult', 'Tous les champs sont obligatoires !', false);
      return;
    }

    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiant, password })
    });
    
    const data = await res.json();

    if (data.ok) {
        console.log(res.message);

      //Connexion à la socket our recuperer le vrai userId
      //socket.disconnect();
      //socket.connect();
        
        // Redirection vers /partie après connexion réussie
        window.location.href = "/lobby";
    } else {
        alert(data.message);
    }
  };

  document.getElementById('btnRegister').onclick = async () => {
    const identifiant = document.getElementById('regId').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const pseudo = document.getElementById('regPseudo').value.trim();
    const color = document.getElementById('regColor').value;

    if (!identifiant || !password || !pseudo){
      showResult('regResult', 'Tous les champs sont obligatoires !', false);
      return;
    }

    const res = await api('/auth/register', { identifiant, password, pseudo, color });
    showResult('regResult', res.message, res.ok);    
  };


  document.getElementById('btnLogin').onclick = async () => {
    const identifiant = document.getElementById('identifiant').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!identifiant || !password){
      showResult('loginResult', 'Tous les champs sont obligatoires !', false);
      return;
    }

    const res = await api('/auth/login', { identifiant, password });
    
    if (res.ok) {
        console.log(res.message);
        // Redirection vers /partie après connexion réussie
        window.location.href = "/lobby";
    } else {
        alert(res.message);
    }

  };
})();
