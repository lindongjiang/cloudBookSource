(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
      return;
    }
    fn();
  }

  onReady(function () {
    var mobileBtn = document.querySelector('.mobile-icon');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', function () {
        var nav = document.querySelector('.header .nav');
        if (nav) {
          nav.classList.toggle('layui-show');
        }
      });
    }

    var searchBtn = document.getElementById('sokeybtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        var panel = document.getElementById('filterPanel');
        if (!panel) return;
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
      });
    }
  });
})();
