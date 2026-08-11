package app.remote.universal;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 4201;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IrPlugin.class);
        registerPlugin(NativeBluetoothPlugin.class);
        registerPlugin(NativeAndroidTvPlugin.class);
        registerPlugin(XstreamGattPlugin.class);
        registerPlugin(NativeSpeechPlugin.class);
        registerPlugin(AdsPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(FeedbackPlugin.class);

        super.onCreate(savedInstanceState);
        requestRuntimePermissions();
    }

    /** Ask for every hardware permission the remote needs, right at launch. */
    private void requestRuntimePermissions() {
        List<String> wanted = new ArrayList<>();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            wanted.add(Manifest.permission.BLUETOOTH_SCAN);
            wanted.add(Manifest.permission.BLUETOOTH_CONNECT);
            wanted.add(Manifest.permission.BLUETOOTH_ADVERTISE);
        } else {
            wanted.add(Manifest.permission.BLUETOOTH);
            wanted.add(Manifest.permission.BLUETOOTH_ADMIN);
        }

        // Bluetooth scanning on Android 11 and below is gated behind location.
        wanted.add(Manifest.permission.ACCESS_FINE_LOCATION);
        wanted.add(Manifest.permission.ACCESS_COARSE_LOCATION);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            wanted.add(Manifest.permission.NEARBY_WIFI_DEVICES);
        }

        wanted.add(Manifest.permission.RECORD_AUDIO);

        List<String> missing = new ArrayList<>();
        for (String permission : wanted) {
            if (ContextCompat.checkSelfPermission(this, permission)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }

        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this, missing.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }
}
