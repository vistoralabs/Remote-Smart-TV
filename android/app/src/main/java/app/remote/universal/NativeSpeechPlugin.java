package app.remote.universal;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

/** Android speech recognition, so voice search text can be typed on the box. */
@CapacitorPlugin(
        name = "NativeSpeech",
        permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) })
public class NativeSpeechPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall pending;
    private String partialText = "";

    @PluginMethod public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        result.put("granted", getPermissionState("microphone") == com.getcapacitor.PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod public void listen(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterPermission");
            return;
        }
        start(call);
    }

    @PermissionCallback private void afterPermission(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Microphone permission is needed for voice search");
            return;
        }
        start(call);
    }

    private void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is not available on this phone");
            return;
        }
        String language = call.getString("lang", Locale.getDefault().toLanguageTag());
        main.post(() -> {
            try {
                stopRecognizer();
                pending = call;
                partialText = "";
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { emit("listening"); }
                    @Override public void onBeginningOfSpeech() { emit("listening"); }
                    @Override public void onRmsChanged(float rms) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() { emit("processing"); }
                    @Override public void onError(int code) {
                        /* No-match / timeout still hands back whatever the mic already heard. */
                        if (partialText != null && !partialText.trim().isEmpty()) {
                            finish(partialText, null);
                            return;
                        }
                        finish(null, describe(code));
                    }
                    @Override public void onPartialResults(Bundle partial) {
                        ArrayList<String> list = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (list != null && !list.isEmpty() && list.get(0) != null) partialText = list.get(0);
                    }
                    @Override public void onEvent(int type, Bundle params) {}
                    @Override public void onResults(Bundle results) {
                        ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = list == null || list.isEmpty() ? "" : list.get(0);
                        if ((text == null || text.trim().isEmpty()) && partialText != null) text = partialText;
                        finish(text == null ? "" : text, null);
                    }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
                intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
                /* Give people time to actually speak before the recognizer gives up. */
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2000L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
                recognizer.startListening(intent);
            } catch (Exception error) {
                finish(null, error.getMessage() == null ? "Voice input failed" : error.getMessage());
            }
        });
    }

    private static String describe(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_AUDIO: return "Mic audio could not be recorded";
            case SpeechRecognizer.ERROR_CLIENT: return "Voice input was interrupted — try again";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microphone permission is needed for voice search";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Voice search needs an internet connection";
            case SpeechRecognizer.ERROR_NO_MATCH: return "Nothing was heard — try again";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Recognizer is busy — try again";
            case SpeechRecognizer.ERROR_SERVER: return "Speech service error — try again";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech detected — hold and speak";
            default: return "Voice input failed (" + code + ")";
        }
    }


    private void emit(String state) {
        JSObject event = new JSObject();
        event.put("state", state);
        notifyListeners("voiceState", event);
    }

    private void finish(String text, String error) {
        PluginCall call = pending;
        pending = null;
        stopRecognizer();
        emit(error == null ? "done" : "failed");
        if (call == null) return;
        if (error != null) { call.reject(error); return; }
        JSObject result = new JSObject();
        result.put("text", text);
        call.resolve(result);
    }

    private void stopRecognizer() {
        try { if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); } } catch (Exception ignored) {}
        recognizer = null;
    }

    @PluginMethod public void cancel(PluginCall call) {
        main.post(() -> { finish("", null); call.resolve(); });
    }

    @Override protected void handleOnDestroy() {
        main.post(this::stopRecognizer);
        super.handleOnDestroy();
    }
}
