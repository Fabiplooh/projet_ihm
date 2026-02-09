(() => {
  // Fonction pour que les boites de résultats soient invisible au début, et apparaissent que lorsque l'on a un resultat
  function showResult(elementId, message, isSuccess = true) {
    document.querySelectorAll('.result').forEach(elem => {
      elem.classList.remove('visible', 'error');
      elem.textContent = '';
    });

    const element = document.getElementById(elementId);
    element.textContent = message;
    if (isSuccess){
      element.className = 'result visible';
    } else {
      element.className = 'result error visible';
    }
  }

  const api = (url, data) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());

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
        window.location.href = "/partie";
    } else {
        alert(res.message);
    }

  };
})();
