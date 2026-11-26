(function () {
  var f = document.getElementById('filter');
  if (f) {
    f.addEventListener('input', function () {
      var q = f.value.trim().toUpperCase();
      document.querySelectorAll('.tickers li').forEach(function (li) {
        li.hidden = q && li.getAttribute('data-t').indexOf(q) === -1;
      });
    });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
})();
