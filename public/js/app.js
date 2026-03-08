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

    var toolSearchInput = document.getElementById('toolSearchInput');
    var toolCategoryTabs = document.getElementById('toolCategoryTabs');
    var toolSections = Array.prototype.slice.call(document.querySelectorAll('.tool-section'));
    var toolNoResult = document.getElementById('toolNoResult');
    if (toolSearchInput && toolCategoryTabs && toolSections.length > 0) {
      var activeFilter = 'all';

      function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
      }

      function applyToolFilter() {
        var keyword = normalizeText(toolSearchInput.value);
        var visibleCardCount = 0;

        toolSections.forEach(function (section) {
          var sectionVisible = false;
          var cards = Array.prototype.slice.call(section.querySelectorAll('.pdf-tool-card'));

          cards.forEach(function (card) {
            var cardGroup = normalizeText(card.getAttribute('data-group'));
            var cardKeywords = normalizeText(card.getAttribute('data-keywords'));
            var passGroup = activeFilter === 'all' || cardGroup === activeFilter;
            var passSearch = !keyword || cardKeywords.indexOf(keyword) > -1;
            var shouldShow = passGroup && passSearch;

            card.style.display = shouldShow ? '' : 'none';
            if (shouldShow) {
              sectionVisible = true;
              visibleCardCount += 1;
            }
          });

          section.style.display = sectionVisible ? '' : 'none';
        });

        if (toolNoResult) {
          toolNoResult.style.display = visibleCardCount > 0 ? 'none' : 'block';
        }
      }

      var chips = Array.prototype.slice.call(toolCategoryTabs.querySelectorAll('.tool-category-chip'));
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          chips.forEach(function (item) {
            item.classList.remove('active');
          });
          chip.classList.add('active');
          activeFilter = normalizeText(chip.getAttribute('data-filter')) || 'all';
          applyToolFilter();
        });
      });

      toolSearchInput.addEventListener('input', applyToolFilter);
      applyToolFilter();
    }
  });
})();
