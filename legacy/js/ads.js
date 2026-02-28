(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function initAds() {
    var ad = byId('adSidebar');
    if (!ad) return;

    var closeBtn = byId('adClose');
    var storageKey = 'bf_ad_hide_refrigerante_cola';

    try {
      if (localStorage.getItem(storageKey) === '1') {
        ad.classList.add('ad-hidden');
        return;
      }
    } catch (e) {
      // Ignora (modo privado / bloqueio)
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        ad.classList.add('ad-hidden');
        try {
          localStorage.setItem(storageKey, '1');
        } catch (e) {
          // Ignora
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
