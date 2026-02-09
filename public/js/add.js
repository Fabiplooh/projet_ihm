document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addForm');
  const resultEl = document.getElementById('result');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = document.getElementById('a').value;
    const b = document.getElementById('b').value;
    try {
      const res = await fetch('/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a, b })
      });
      if (!res.ok) {
        const err = await res.json();
        resultEl.hidden = false;
        resultEl.textContent = 'Erreur: ' + (err.error || res.statusText);
        return;
      }
      const data = await res.json();
      resultEl.hidden = false;
      resultEl.textContent = `${a} + ${b} = ${data.result}`;
    } catch (err) {
      resultEl.hidden = false;
      resultEl.textContent = 'Erreur réseau';
    }
  });
});
