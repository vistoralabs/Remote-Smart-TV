package app.remote.universal;

import android.content.Context;
import android.media.AudioManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.SoundEffectConstants;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Key feedback bridge: real vibration through the system Vibrator and the system
 * key-click sound through AudioManager. The WebView's navigator.vibrate is
 * unreliable inside Capacitor, so every press goes through here.
 */
@CapacitorPlugin(name = "Feedback")
public class FeedbackPlugin extends Plugin {

    private Vibrator vibrator() {
        Context context = getContext();
        if (context == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager =
                    (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        Integer ms = call.getInt("ms", 18);
        int duration = ms == null || ms <= 0 ? 18 : Math.min(ms, 200);
        Vibrator vibrator = vibrator();
        boolean ok = false;
        if (vibrator != null && vibrator.hasVibrator()) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(
                            duration, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(duration);
                }
                ok = true;
            } catch (Throwable ignored) {
                ok = false;
            }
        }
        call.resolve(new JSObject().put("ok", ok));
    }

    @PluginMethod
    public void click(PluginCall call) {
        boolean ok = false;
        try {
            Context context = getContext();
            AudioManager audio = context == null
                    ? null
                    : (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audio != null) {
                audio.playSoundEffect(AudioManager.FX_KEY_CLICK, 1.0f);
                ok = true;
            }
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().playSoundEffect(SoundEffectConstants.CLICK);
                ok = true;
            }
        } catch (Throwable ignored) {
            /* keep silent */
        }
        call.resolve(new JSObject().put("ok", ok));
    }
}
