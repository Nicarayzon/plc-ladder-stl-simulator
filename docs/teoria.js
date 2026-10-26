// Páginas de teoría: botón de tema claro / oscuro (la misma preferencia que la portada).

document.getElementById('cambiar-tema').addEventListener('click', () => {
  const raiz = document.documentElement;
  const oscuro = raiz.dataset.theme ? raiz.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
  raiz.dataset.theme = oscuro ? 'light' : 'dark';
  try { localStorage.setItem('automatizacion-web-tema', raiz.dataset.theme); } catch (e) { /* da igual */ }
});
