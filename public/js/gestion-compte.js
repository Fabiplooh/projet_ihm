(() => {
  //const socket = io();

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

  const backBtn = document.getElementById("backBtn");
  backBtn.onclick = async () => {
    window.location.href = "/lobby";
  };

  // Comportement profil
  document.getElementById('btnMe').onclick = async () => {
    const res = await api('/me',{});
    showResult('meResult', res.message, res.ok);
  };

  // Comportement déconnexion
  document.getElementById('btnLogout').onclick = async () => {
    const res = await api('/auth/logout', {});

    if (res.ok) {
        console.log(res.message);
        //socket.disconnect();
        // Redirection vers /partie après connexion réussie
        window.location.href = "/login";
    } else {
        alert(res.message);
    }

  };
})();
