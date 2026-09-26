package id.ptsivp.workmanagement;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Pesan FCM saat aplikasi sedang terbuka (saat tertutup, sistem menampilkan
 * notifikasinya sendiri di kanal "notifikasi").
 */
public class LayananPesan extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        String judul = m.getNotification() != null ? m.getNotification().getTitle() : d.get("title");
        String isi = m.getNotification() != null ? m.getNotification().getBody() : d.get("body");
        Notifikasi.tampilkan(this, judul != null ? judul : getString(R.string.app_name), isi != null ? isi : "", d.get("url"));
    }

    @Override
    public void onNewToken(String token) {
        // Token baru diserahkan ke halaman saat dibuka berikutnya (sisip.js
        // mendaftarkannya karena pasangan token+user berubah).
    }
}
