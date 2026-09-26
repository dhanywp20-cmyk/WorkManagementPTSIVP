package id.ptsivp.workmanagement;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;

/** Kanal notifikasi berbunyi (notif.wav, sama dengan web) + penampil notifikasi. */
final class Notifikasi {
    static final String KANAL = "notifikasi";

    private Notifikasi() {}

    static void pastikanKanal(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(KANAL) != null) return;
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

    static void tampilkan(Context c, String judul, String isi, String url) {
        pastikanKanal(c);
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("url", url);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int id = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, KANAL)
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
