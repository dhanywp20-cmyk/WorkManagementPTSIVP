package id.ptsivp.workmanagement;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;

/**
 * Kanal notifikasi berbunyi (notif.wav, sama dengan web) + penampil notifikasi.
 *
 * Bunyi SEKALI per rentetan: notifikasi yang datang berdekatan (mis. beberapa tiket
 * sekaligus, atau antrean yang masuk begitu HP online) cukup satu bunyi - sisanya
 * masuk lewat kanal senyap (tetap tampil di panel & titik di ikon aplikasi). Senyap
 * juga saat aplikasi sedang dibuka: alarm di halaman web sudah berbunyi.
 */
final class Notifikasi {
    static final String KANAL = "notifikasi";
    static final String KANAL_SENYAP = "notifikasi-senyap";
    static final long JEDA_BUNYI_MS = 10_000;

    private Notifikasi() {}

    static void pastikanKanal(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(KANAL_SENYAP) == null) {
            NotificationChannel senyap = new NotificationChannel(KANAL_SENYAP, "Notifikasi kerja (lanjutan, senyap)", NotificationManager.IMPORTANCE_DEFAULT);
            senyap.setDescription("Notifikasi yang datang berdekatan - tidak berbunyi lagi");
            senyap.setSound(null, null);
            senyap.enableVibration(false);
            nm.createNotificationChannel(senyap);
        }
        if (nm.getNotificationChannel(KANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(KANAL, "Notifikasi kerja", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Tiket, jadwal, request project, dan pengingat");
        Uri suara = Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.notif);
        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        ch.setSound(suara, aa);
        ch.enableVibration(true);
        ch.enableLights(true);
        nm.createNotificationChannel(ch);
    }

    /** Boleh berbunyi bila bunyi terakhir sudah lewat JEDA_BUNYI_MS (dicatat - proses bisa mati di antara pesan). */
    private static synchronized boolean bolehBunyi(Context c) {
        SharedPreferences sp = c.getSharedPreferences("notifikasi", Context.MODE_PRIVATE);
        long kini = System.currentTimeMillis();
        if (kini - sp.getLong("terakhirBunyi", 0) < JEDA_BUNYI_MS) return false;
        sp.edit().putLong("terakhirBunyi", kini).apply();
        return true;
    }

    static void tampilkan(Context c, String judul, String isi, String url) {
        pastikanKanal(c);
        String kanal = !MainActivity.terlihat && bolehBunyi(c) ? KANAL : KANAL_SENYAP;
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("url", url);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int id = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, kanal)
                .setSmallIcon(R.drawable.ic_notif)
                .setColor(0xFFE11D48)
                .setContentTitle(judul)
                .setContentText(isi)
                .setStyle(new Notification.BigTextStyle().bigText(isi))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, n);
    }
}
