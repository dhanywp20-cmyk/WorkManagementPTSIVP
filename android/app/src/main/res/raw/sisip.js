// Disisipkan MainActivity ke setiap halaman. Menjembatani fitur web yang
// tidak berjalan di WebView: unduh blob (Excel/PDF), cetak, jendela baru,
// dan pendaftaran token notifikasi.
(function () {
  if (window.__wmAndroid) return;
  window.__wmAndroid = true;

  function simpan(href, nama) {
    fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
      var fr = new FileReader();
      fr.onload = function () { AndroidApp.simpanBerkas(fr.result, nama || 'unduhan', b.type || ''); };
      fr.readAsDataURL(b);
    }).catch(function (e) { alert('Gagal mengunduh: ' + e); });
  }
  window.__unduhBlob = simpan;

  function tangani(a) {
    var h = (a && a.href) || '';
    if (h.indexOf('blob:') !== 0 && h.indexOf('data:') !== 0) return false;
    simpan(h, a.getAttribute('download'));
    return true;
  }
  // file-saver memicu klik pada <a> yang tidak ditempel ke dokumen.
  var klikAsli = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!tangani(this)) klikAsli.call(this); };
  var kirimAsli = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (e) {
    if (this instanceof HTMLAnchorElement && e && e.type === 'click' && tangani(this)) return true;
    return kirimAsli.call(this, e);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && tangani(a)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.print = function () { AndroidApp.cetak(); };

  // Cetak tiket/request: window.open('') lalu document.write + print().
  window.open = function (url) {
    if (!url || url === 'about:blank') {
      var isi = '';
      var palsu = {
        closed: false,
        document: {
          write: function (s) { isi += s; }, writeln: function (s) { isi += s + '\n'; },
          open: function () { isi = ''; }, close: function () {}
        },
        print: function () { AndroidApp.cetakHtml(isi); },
        close: function () { palsu.closed = true; }, focus: function () {}
      };
      return palsu;
    }
    AndroidApp.bukaTautan(String(new URL(url, location.href)));
    return null;
  };

  // Token FCM dikaitkan ke user yang SEDANG login (sessionStorage ivp_user).
  // Dicek tiap 15 dtk karena login/ganti akun di dashboard tidak memuat ulang
  // halaman; dikirim hanya bila pasangan token+user berubah.
  window.__daftarFcm = function (token) {
    window.__fcmToken = token;
    if (window.__fcmJalan) return;
    window.__fcmJalan = true;
    function userSekarang() {
      try { var u = JSON.parse(sessionStorage.getItem('ivp_user') || 'null'); return u && u.id; } catch (e) { return null; }
    }
    function cek() {
      var uid = userSekarang(); if (!uid || !window.__fcmToken) return;
      var kunci = window.__fcmToken + '|' + uid;
      try { if (localStorage.getItem('wm_fcm') === kunci) return; } catch (e) {}
      fetch('/api/push/fcm', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: window.__fcmToken })
      }).then(function (r) { if (r.ok) { try { localStorage.setItem('wm_fcm', kunci); } catch (e) {} } })
        .catch(function () {});
    }
    cek();
    setInterval(cek, 15000);
  };
})();
