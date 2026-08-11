package app.remote.universal;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppQosSettings;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Turns the phone into a real Bluetooth HID remote.
 *
 * The profile only works when the app stays registered as an HID device and the
 * TV / set-top box accepts an incoming HID connection, so registration happens
 * as soon as the plugin loads instead of lazily on the first key press. Every
 * asynchronous step carries a timeout so a key press always resolves with a
 * message the UI can show.
 */
@CapacitorPlugin(
        name = "NativeBluetooth",
        permissions = {
                @Permission(alias = "nearby", strings = {
                        "android.permission.BLUETOOTH_SCAN",
                        "android.permission.BLUETOOTH_CONNECT",
                        Manifest.permission.ACCESS_FINE_LOCATION
                })
        })
public class NativeBluetoothPlugin extends Plugin {
    private static final int CONNECT_TIMEOUT_MS = 12000;
    private static final int REGISTER_TIMEOUT_MS = 8000;

    private BluetoothAdapter adapter;
    private BluetoothHidDevice hidDevice;
    private boolean registered;

    private BluetoothDevice target;
    private BluetoothDevice linked;
    private String lastError;

    private PluginCall pendingCall;
    private String pendingKey;
    private Runnable pendingTimeout;

    private final Handler main = new Handler(Looper.getMainLooper());

    /** Consumer control page (report 1) + boot keyboard (report 2). */
    private static final byte[] HID_DESCRIPTOR = new byte[] {
            0x05, 0x0c, 0x09, 0x01, (byte) 0xa1, 0x01, (byte) 0x85, 0x01,
            0x15, 0x00, 0x26, (byte) 0xff, 0x03, 0x19, 0x00, 0x2a, (byte) 0xff,
            0x03, 0x75, 0x10, (byte) 0x95, 0x01, (byte) 0x81, 0x00, (byte) 0xc0,
            0x05, 0x01, 0x09, 0x06, (byte) 0xa1, 0x01, (byte) 0x85, 0x02,
            0x05, 0x07, 0x19, (byte) 0xe0, 0x29, (byte) 0xe7, 0x15, 0x00, 0x25,
            0x01, 0x75, 0x01, (byte) 0x95, 0x08, (byte) 0x81, 0x02, (byte) 0x95,
            0x01, 0x75, 0x08, (byte) 0x81, 0x01, (byte) 0x95, 0x06, 0x75, 0x08,
            0x15, 0x00, 0x25, 0x65, 0x19, 0x00, 0x29, 0x65, (byte) 0x81, 0x00,
            (byte) 0xc0
    };

    @Override
    public void load() {
        android.bluetooth.BluetoothManager manager = (android.bluetooth.BluetoothManager)
                getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
        ensureProxy();
    }

    private boolean permitted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                        == PackageManager.PERMISSION_GRANTED;
    }

    private boolean advertisePermitted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADVERTISE)
                        == PackageManager.PERMISSION_GRANTED;
    }

    private boolean scanPermitted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
                        == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hidSupported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P;
    }

    /** Requests the HID_DEVICE proxy once; registration continues in the listener. */
    private void ensureProxy() {
        if (adapter == null || hidDevice != null || !hidSupported()) return;
        if (!permitted() || !adapter.isEnabled()) return;
        adapter.getProfileProxy(getContext(), profileListener, BluetoothProfile.HID_DEVICE);
    }

    private void emitState() {
        JSObject state = new JSObject();
        state.put("registered", registered);
        state.put("connected", linked != null);
        state.put("address", linked == null ? null : linked.getAddress());
        state.put("error", lastError);
        notifyListeners("hidState", state);
    }

    // ---------------------------------------------------------------- methods

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", adapter != null && hidSupported());
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void status(PluginCall call) {
        ensureProxy();
        JSObject result = new JSObject();
        result.put("supported", hidSupported());
        result.put("enabled", adapter != null && adapter.isEnabled());
        result.put("registered", registered);
        result.put("connected", linked != null);
        result.put("address", linked == null ? null : linked.getAddress());
        result.put("name", linked == null ? null : safeName(linked));
        result.put("error", lastError);
        call.resolve(result);
    }

    /**
     * A TV is the Bluetooth host and this phone is the HID peripheral. Therefore
     * the reliable pairing direction is TV -> phone, not phone -> TV. This makes
     * the phone visible while the user scans from the TV's Add accessory page.
     */
    @PluginMethod
    public void prepareRemote(PluginCall call) {
        String problem = blocker();
        if (problem != null) { call.reject(problem); return; }
        if (!advertisePermitted()) {
            call.reject("Allow Nearby devices permission so the TV can find this phone");
            return;
        }
        ensureProxy();
        try {
            Intent visible = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
            visible.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300);
            getActivity().startActivity(visible);
            JSObject result = new JSObject();
            result.put("discoverable", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not make this phone visible: " + error.getMessage());
        }
    }

    @PermissionCallback
    private void scanPermsCallback(PluginCall call) {
        scan(call);
    }

    /**
     * Scans classic Bluetooth AND Bluetooth LE at the same time and returns every
     * device that answers, paired or not. Many set-top boxes (Jio Hybrid STB,
     * Xstream) only advertise over LE, so they never show up in Android's
     * Bluetooth Settings list or in a classic discovery.
     */
    @PluginMethod
    public void scan(PluginCall call) {
        if (adapter == null) { call.reject("This phone has no Bluetooth adapter"); return; }
        if (!permitted() || !scanPermitted()) {
            requestPermissionForAlias("nearby", call, "scanPermsCallback");
            return;
        }
        if (!adapter.isEnabled()) { call.reject("Turn on Bluetooth, then tap Scan again"); return; }
        ensureProxy();

        final Map<String, JSObject> found = new LinkedHashMap<>();
        for (BluetoothDevice device : adapter.getBondedDevices()) {
            found.put(device.getAddress(), describe(device.getAddress(), safeName(device), true, null, "bonded"));
        }

        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) return;
                BluetoothDevice device;
                if (Build.VERSION.SDK_INT >= 33) {
                    device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
                } else {
                    device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                }
                if (device == null) return;
                short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE);
                remember(found, device.getAddress(), safeName(device),
                        device.getBondState() == BluetoothDevice.BOND_BONDED,
                        rssi == Short.MIN_VALUE ? null : (int) rssi, "classic");
            }
        };
        ContextCompat.registerReceiver(
                getContext(), receiver, new IntentFilter(BluetoothDevice.ACTION_FOUND),
                ContextCompat.RECEIVER_NOT_EXPORTED);

        boolean classicStarted = false;
        try { classicStarted = adapter.startDiscovery(); } catch (Exception ignored) {}

        final BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        final ScanCallback leCallback = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult result) { keep(result); }
            @Override public void onBatchScanResults(java.util.List<ScanResult> results) {
                for (ScanResult result : results) keep(result);
            }
            @Override public void onScanFailed(int errorCode) {
                lastError = "BLE scan failed with code " + errorCode;
            }
            private void keep(ScanResult result) {
                BluetoothDevice device = result.getDevice();
                if (device == null) return;
                String name = safeName(device);
                if (name == null || name.isEmpty()) {
                    ScanRecord record = result.getScanRecord();
                    if (record != null && record.getDeviceName() != null) name = record.getDeviceName();
                }
                remember(found, device.getAddress(), name,
                        device.getBondState() == BluetoothDevice.BOND_BONDED, result.getRssi(), "ble");
            }
        };

        boolean leStarted = false;
        if (scanner != null) {
            try {
                ScanSettings.Builder settings = new ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    settings.setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                            .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                            .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT);
                }
                // Empty filter list on purpose: never filter by name, service or bond state.
                scanner.startScan(new java.util.ArrayList<ScanFilter>(), settings.build(), leCallback);
                leStarted = true;
            } catch (Exception error) {
                lastError = "BLE scan could not start: " + error.getMessage();
            }
        }

        if (!classicStarted && !leStarted) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            call.reject("Bluetooth scan could not start. Turn Bluetooth off and on, then try again");
            return;
        }

        final BluetoothLeScanner leScanner = scanner;
        final boolean stopLe = leStarted;
        main.postDelayed(() -> {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            try { adapter.cancelDiscovery(); } catch (Exception ignored) {}
            if (stopLe && leScanner != null) {
                try { leScanner.stopScan(leCallback); } catch (Exception ignored) {}
            }
            JSArray devices = new JSArray();
            for (JSObject item : found.values()) devices.put(item);
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        }, 14000);
    }

    private JSObject describe(String address, String name, boolean bonded, Integer rssi, String via) {
        JSObject item = new JSObject();
        item.put("id", address);
        item.put("name", name == null || name.isEmpty() ? address : name);
        item.put("bonded", bonded);
        item.put("via", via);
        if (rssi != null) item.put("rssi", (int) rssi);
        return item;
    }

    /** Keeps the richest record for an address: a real name always wins over a blank one. */
    private void remember(Map<String, JSObject> found, String address, String name,
                          boolean bonded, Integer rssi, String via) {
        if (address == null) return;
        JSObject existing = found.get(address);
        if (existing != null) {
            String had = existing.getString("name");
            boolean hadName = had != null && !had.isEmpty() && !had.equals(address);
            if (hadName || name == null || name.isEmpty()) {
                if (rssi != null) existing.put("rssi", (int) rssi);
                return;
            }
        }
        found.put(address, describe(address, name, bonded, rssi, via));
    }


    @PluginMethod
    public void pair(PluginCall call) {
        if (adapter == null || !permitted()) { call.reject("Bluetooth permission is missing"); return; }
        String address = call.getString("address");
        if (address == null) { call.reject("Device address is missing"); return; }
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() == BluetoothDevice.BOND_BONDED) {
                JSObject result = new JSObject(); result.put("paired", true); call.resolve(result);
            } else if (device.createBond()) {
                JSObject result = new JSObject(); result.put("paired", false); call.resolve(result);
            } else call.reject("Android could not start pairing");
        } catch (Exception error) { call.reject("Pairing failed: " + error.getMessage()); }
    }

    /** Opens the HID link without sending a key, so the UI can show a live state. */
    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null) { call.reject("Device address is missing"); return; }
        String problem = blocker();
        if (problem != null) { call.reject(problem); return; }
        target = adapter.getRemoteDevice(address);
        if (target.getBondState() != BluetoothDevice.BOND_BONDED) {
            call.reject("Pair from the TV first: open Add accessory on the TV and select this phone");
            return;
        }
        rejectSuperseded();
        lastError = null;
        pendingCall = call;
        pendingKey = null;
        armTimeout(registered ? CONNECT_TIMEOUT_MS : REGISTER_TIMEOUT_MS,
                registered
                        ? "The TV did not accept the remote connection. On the TV go to Settings \u2192 Remotes / Add accessory, keep it on that screen, then tap Connect again."
                        : "Android did not start Bluetooth remote mode. Turn Bluetooth off and on, then reopen the app.");
        ensureProxy();
        if (registered) openLink();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (hidDevice != null && linked != null) hidDevice.disconnect(linked);
        linked = null;
        emitState();
        call.resolve();
    }

    @PluginMethod
    public void sendKey(PluginCall call) {
        String address = call.getString("address");
        String key = call.getString("key");
        if (address == null || key == null) { call.reject("Device or key is missing"); return; }
        String problem = blocker();
        if (problem != null) { call.reject(problem); return; }

        BluetoothDevice device = adapter.getRemoteDevice(address);
        if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
            call.reject("Pair this device in the app first"); return;
        }
        if (mappedReport(key) == null) {
            call.reject("This key has no Bluetooth code \u2014 use Wi\u2011Fi or IR for it"); return;
        }

        target = device;

        // Fast path: link already open, send straight away and resolve now.
        if (registered && linked != null && linked.getAddress().equals(address)) {
            JSObject result = transmit(device, key);
            if (result == null) { call.reject("The TV rejected the Bluetooth key"); return; }
            call.resolve(result);
            return;
        }

        rejectSuperseded();
        pendingCall = call;
        pendingKey = key;
        armTimeout(registered ? CONNECT_TIMEOUT_MS : REGISTER_TIMEOUT_MS,
                registered
                        ? "No Bluetooth remote link yet. Put the TV / box on its \"add remote\" screen and tap Connect, or use Wi\u2011Fi / IR."
                        : "Android did not start Bluetooth remote mode. Turn Bluetooth off and on, then reopen the app.");
        ensureProxy();
        if (registered) openLink();
    }

    // ------------------------------------------------------------- internals

    private String blocker() {
        if (!hidSupported()) return "Bluetooth remote keys need Android 9 or newer";
        if (adapter == null) return "This phone has no Bluetooth adapter";
        if (!permitted()) return "Allow the Nearby devices permission, then try again";
        if (!adapter.isEnabled()) return "Turn on Bluetooth, then try again";
        return null;
    }

    private String safeName(BluetoothDevice device) {
        String name = device.getName();
        return name == null || name.isEmpty() ? device.getAddress() : name;
    }

    private void armTimeout(int delay, String message) {
        clearTimeout();
        pendingTimeout = () -> rejectPending(message);
        main.postDelayed(pendingTimeout, delay);
    }

    private void rejectSuperseded() {
        if (pendingCall != null) {
            pendingCall.reject("A newer Bluetooth request replaced this one");
            pendingCall = null;
            pendingKey = null;
            clearTimeout();
        }
    }

    private void clearTimeout() {
        if (pendingTimeout != null) main.removeCallbacks(pendingTimeout);
        pendingTimeout = null;
    }

    private void openLink() {
        if (hidDevice == null || target == null) return;
        if (hidDevice.getConnectionState(target) == BluetoothProfile.STATE_CONNECTED) {
            linked = target;
            emitState();
            flushPending();
        } else if (!hidDevice.connect(target)) {
            rejectPending("Android refused to open the Bluetooth remote link. Unpair the device in phone settings, pair it again from the app, then retry.");
        }
    }

    private void flushPending() {
        if (pendingCall == null) return;
        clearTimeout();
        PluginCall call = pendingCall;
        String key = pendingKey;
        pendingCall = null;
        pendingKey = null;

        if (key == null) {
            JSObject result = new JSObject();
            result.put("connected", true);
            call.resolve(result);
            return;
        }
        JSObject result = transmit(target, key);
        if (result == null) call.reject("The TV rejected the Bluetooth key");
        else call.resolve(result);
    }

    /** @return report payload description, or null when the key is unmapped. */
    private byte[] mappedReport(String key) {
        int consumer = consumerCode(key);
        if (consumer >= 0) {
            return new byte[] { (byte) (consumer & 0xff), (byte) ((consumer >> 8) & 0xff) };
        }
        int keyboard = keyboardCode(key);
        if (keyboard < 0) return null;
        return new byte[] { 0, 0, (byte) keyboard, 0, 0, 0, 0, 0 };
    }

    /** Sends press + release. Returns null when the stack refused the report. */
    private JSObject transmit(BluetoothDevice device, String key) {
        if (hidDevice == null || device == null) return null;
        byte[] report = mappedReport(key);
        if (report == null) return null;
        int reportId = report.length == 2 ? 1 : 2;
        boolean sent = hidDevice.sendReport(device, reportId, report);
        if (!sent) return null;
        byte[] release = new byte[report.length];
        main.postDelayed(() -> {
            if (hidDevice != null) hidDevice.sendReport(device, reportId, release);
        }, 40);
        JSObject result = new JSObject();
        result.put("sent", true);
        result.put("reportId", reportId);
        return result;
    }

    private void rejectPending(String message) {
        clearTimeout();
        lastError = message;
        if (pendingCall != null) pendingCall.reject(message);
        pendingCall = null;
        pendingKey = null;
        emitState();
    }

    private final BluetoothProfile.ServiceListener profileListener = new BluetoothProfile.ServiceListener() {
        @Override public void onServiceConnected(int profile, BluetoothProfile proxy) {
            if (!hidSupported() || profile != BluetoothProfile.HID_DEVICE) return;
            hidDevice = (BluetoothHidDevice) proxy;
            BluetoothHidDeviceAppSdpSettings settings = new BluetoothHidDeviceAppSdpSettings(
                    "Smart TV Remote", "Phone remote control", "Smart TV Remote",
                    BluetoothHidDevice.SUBCLASS1_KEYBOARD, HID_DESCRIPTOR);
            Executor executor = ContextCompat.getMainExecutor(getContext());
            hidDevice.registerApp(settings, null, (BluetoothHidDeviceAppQosSettings) null,
                    executor, hidCallback);
        }
        @Override public void onServiceDisconnected(int profile) {
            hidDevice = null;
            registered = false;
            linked = null;
            emitState();
        }
    };

    private final BluetoothHidDevice.Callback hidCallback = new BluetoothHidDevice.Callback() {
        @Override public void onAppStatusChanged(BluetoothDevice pluggedDevice, boolean isRegistered) {
            registered = isRegistered;
            if (isRegistered) lastError = null;
            emitState();
            if (isRegistered) {
                if (target != null) openLink();
            } else {
                rejectPending("Android stopped Bluetooth remote mode. Turn Bluetooth off and on, then reopen the app.");
            }
        }

        @Override public void onConnectionStateChanged(BluetoothDevice device, int state) {
            if (state == BluetoothProfile.STATE_CONNECTED) {
                linked = device;
                target = device;
                lastError = null;
                emitState();
                flushPending();
            } else if (state == BluetoothProfile.STATE_CONNECTING) {
                lastError = null;
                emitState();
            } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                if (linked != null && linked.getAddress().equals(device.getAddress())) linked = null;
                emitState();
            }
        }

        @Override public void onGetReport(BluetoothDevice device, byte type, byte id, int bufferSize) {
            if (hidDevice == null) return;
            int size = id == 1 ? 2 : 8;
            hidDevice.replyReport(device, type, id, new byte[size]);
        }

        @Override public void onSetReport(BluetoothDevice device, byte type, byte id, byte[] data) {
            // Android TV may initialise keyboard LEDs. Accepting the output
            // report keeps strict hosts from dropping the HID connection.
        }

        @Override public void onVirtualCableUnplug(BluetoothDevice device) {
            if (linked != null && linked.getAddress().equals(device.getAddress())) linked = null;
            lastError = "The TV removed this remote. Pair it again from the TV's Add accessory screen.";
            emitState();
        }
    };

    private int consumerCode(String key) {
        switch (key) {
            case "power": return 0x30; case "volup": return 0xe9; case "voldown": return 0xea;
            case "mute": return 0xe2; case "home": return 0x223; case "back": return 0x224;
            case "menu": return 0x40; case "chup": return 0x9c; case "chdown": return 0x9d;
            case "play": case "pause": return 0xcd; case "rewind": return 0xb4;
            case "forward": return 0xb3; case "input": return 0x1bb; case "info": return 0x60;
            case "guide": return 0x8d; case "exit": return 0x94;
            default: return -1;
        }
    }

    private int keyboardCode(String key) {
        switch (key) {
            case "ok": return 0x28; case "up": return 0x52; case "down": return 0x51;
            case "left": return 0x50; case "right": return 0x4f; case "keyboard": return 0x2c;
            default: return -1;
        }
    }

    @Override
    protected void handleOnDestroy() {
        clearTimeout();
        rejectSuperseded();
        if (adapter != null && hidDevice != null) {
            try { hidDevice.unregisterApp(); } catch (Exception ignored) {}
            try { adapter.closeProfileProxy(BluetoothProfile.HID_DEVICE, hidDevice); }
            catch (Exception ignored) {}
        }
        hidDevice = null;
        registered = false;
        linked = null;
        super.handleOnDestroy();
    }
}
