package id.ptsivp.workmanagement;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Satu layar: WebView yang memuat web produksi. Fitur yang tidak berjalan di
 * WebView biasa dijembatani lewat {@link Jembatan} (lihat res/raw/sisip.js).
 */
public class MainActivity extends Activity {
    static final String HOST = BuildConfig.APP_HOST;
    static final String BASE = "https://" + HOST;

    private static final int REQ_BERKAS = 11;
    private static final int REQ_IZIN = 12;

    private WebView web;
    private WebView webCetak;
    private ValueCallback<Uri[]> callbackBerkas;
    private Uri uriKamera;
    private String sisipJs = "";

    @Override
    protected void onCreate(Bundle simpanan) {
        super.onCreate(simpanan);
        Notifikasi.pastikanKanal(this);
        sisipJs = bacaRaw(R.raw.sisip);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " WorkManagementAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Jembatan(), "AndroidApp");
        web.setWebViewClient(new Klien());
        web.setWebChromeClient(new Krom());
        web.setDownloadListener((url, ua, disposisi, mime, panjang) -> unduh(url, ua, disposisi, mime));

        if (simpanan != null) web.restoreState(simpanan);
        else web.loadUrl(urlDari(getIntent()));

        mintaIzinNotifikasi();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getStringExtra("url") != null) web.loadUrl(urlDari(intent));
    }

    @Override
    protected void onSaveInstanceState(Bundle keluar) {
        super.onSaveInstanceState(keluar);
        web.saveState(keluar);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** URL dari klik notifikasi (relatif atau absolut ke host ini), selain itu dashboard. */
    private String urlDari(Intent intent) {
        String u = intent != null ? intent.getStringExtra("url") : null;
        if (u == null || u.isEmpty()) return BASE + "/dashboard";
        if (u.startsWith("/")) return BASE + u;
        if (u.startsWith(BASE + "/") || u.equals(BASE)) return u;
        return BASE + "/dashboard";
    }

    private void mintaIzinNotifikasi() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_IZIN);
        }
    }

    /** Serahkan token FCM ke sisip.js, yang mengaitkannya ke user yang login. */
    private void daftarkanToken() {
        try {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                if (token != null && token.matches("[A-Za-z0-9:_\\-]+")) {
                    web.evaluateJavascript("window.__daftarFcm && window.__daftarFcm('" + token + "')", null);
                }
            });
        } catch (Throwable t) {
            // Firebase belum dikonfigurasi (build tanpa google-services.json).
        }
    }

    private void bukaLuar(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan ini", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean tautanSendiri(Uri u) {
        String sc = u.getScheme();
        return ("https".equals(sc) || "http".equals(sc)) && HOST.equalsIgnoreCase(u.getHost());
    }

    private void unduh(String url, String ua, String disposisi, String mime) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            web.evaluateJavascript("window.__unduhBlob && window.__unduhBlob(" + jsString(url) + ", '')", null);
            return;
        }
        try {
            String nama = URLUtil.guessFileName(url, disposisi, mime);
            DownloadManager.Request rq = new DownloadManager.Request(Uri.parse(url));
            rq.setMimeType(mime);
            String kue = CookieManager.getInstance().getCookie(url);
            if (kue != null) rq.addRequestHeader("Cookie", kue);
            rq.addRequestHeader("User-Agent", ua);
            rq.setTitle(nama);
            rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= 29) rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nama);
            else rq.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, nama);
            DownloadManager dm = getSystemService(DownloadManager.class);
            if (dm != null) dm.enqueue(rq);
            Toast.makeText(this, "Mengunduh " + nama, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            bukaLuar(Uri.parse(url));
        }
    }

    private void cetakWebView(WebView v, String judul) {
        PrintManager pm = getSystemService(PrintManager.class);
        if (pm != null) pm.print(judul, v.createPrintDocumentAdapter(judul), new PrintAttributes.Builder().build());
    }

    private String bacaRaw(int id) {
        try (InputStream in = getResources().openRawResource(id)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return "";
        }
    }

    private static String jsString(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private class Klien extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (tautanSendiri(u)) return false;
            bukaLuar(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            CookieManager.getInstance().flush();
            v.evaluateJavascript(sisipJs, null);
            daftarkanToken();
        }
    }

    private class Krom extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (callbackBerkas != null) callbackBerkas.onReceiveValue(null);
            callbackBerkas = cb;
            uriKamera = null;

            Intent isi = p.createIntent();
            isi.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            Intent pilih = Intent.createChooser(isi, "Pilih berkas");

            if (terimaGambar(p.getAcceptTypes())) {
                try {
                    File dir = new File(getCacheDir(), "kamera");
                    if (!dir.exists()) dir.mkdirs();
                    File f = File.createTempFile("foto_", ".jpg", dir);
                    uriKamera = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".berkas", f);
                    Intent kamera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    kamera.putExtra(MediaStore.EXTRA_OUTPUT, uriKamera);
                    kamera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    pilih.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{kamera});
                } catch (IOException e) {
                    uriKamera = null;
                }
            }
            try {
                startActivityForResult(pilih, REQ_BERKAS);
                return true;
            } catch (ActivityNotFoundException e) {
                callbackBerkas = null;
                return false;
            }
        }

        private boolean terimaGambar(String[] tipe) {
            if (tipe == null || tipe.length == 0) return true;
            for (String t : tipe) {
                if (t == null || t.isEmpty() || t.contains("image") || t.equals("*/*")) return true;
            }
            return false;
        }
    }

    @Override
    protected void onActivityResult(int req, int hasil, Intent data) {
        super.onActivityResult(req, hasil, data);
        if (req != REQ_BERKAS || callbackBerkas == null) return;
        Uri[] uris = null;
        if (hasil == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData c = data.getClipData();
                uris = new Uri[c.getItemCount()];
                for (int i = 0; i < c.getItemCount(); i++) uris[i] = c.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                uris = new Uri[]{data.getData()};
            } else if (uriKamera != null) {
                uris = new Uri[]{uriKamera};
            }
        }
        callbackBerkas.onReceiveValue(uris);
        callbackBerkas = null;
    }

    /** Dipanggil dari sisip.js. Semua metode berjalan di thread latar WebView. */
    private class Jembatan {
        @JavascriptInterface
        public void simpanBerkas(String dataUrl, String nama, String mime) {
            try {
                int koma = dataUrl.indexOf(',');
                if (mime == null || mime.isEmpty()) {
                    int titikKoma = dataUrl.indexOf(';');
                    mime = (dataUrl.startsWith("data:") && titikKoma > 5) ? dataUrl.substring(5, titikKoma) : "application/octet-stream";
                }
                byte[] isi = Base64.decode(dataUrl.substring(koma + 1), Base64.DEFAULT);
                String namaAman = nama.replaceAll("[\\\\/:*?\"<>|]", "_");
                Uri uri;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, namaAman);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    v.put(MediaStore.Downloads.IS_PENDING, 1);
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IOException("Tidak bisa membuat berkas");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IOException("Tidak bisa menulis berkas");
                        out.write(isi);
                    }
                    v.clear();
                    v.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, v, null, null);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, namaAman);
                    try (FileOutputStream out = new FileOutputStream(f)) { out.write(isi); }
                    uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".berkas", f);
                }
                final Uri akhir = uri;
                final String tipe = mime;
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Tersimpan di Download: " + namaAman, Toast.LENGTH_LONG).show();
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(akhir, tipe)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (ActivityNotFoundException ignored) {
                        // Tidak ada aplikasi pembuka - berkas tetap tersimpan.
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Gagal menyimpan: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void cetak() {
            runOnUiThread(() -> cetakWebView(web, getString(R.string.app_name)));
        }

        @JavascriptInterface
        public void cetakHtml(String html) {
            runOnUiThread(() -> {
                webCetak = new WebView(MainActivity.this);
                webCetak.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        v.postDelayed(() -> cetakWebView(v, getString(R.string.app_name)), 600);
                    }
                });
                webCetak.loadDataWithBaseURL(BASE + "/", html, "text/html", "UTF-8", null);
            });
        }

        @JavascriptInterface
        public void bukaTautan(String url) {
            runOnUiThread(() -> {
                Uri u = Uri.parse(url);
                if (tautanSendiri(u)) web.loadUrl(url);
                else bukaLuar(u);
            });
        }
    }
}
