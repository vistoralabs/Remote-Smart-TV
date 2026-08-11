package app.remote.universal;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
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
import android.os.ParcelUuid;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Diagnostics-grade Bluetooth layer: parallel BLE + Classic discovery with no
 * bonded/paired filter, real bonding through the Android pairing service, and
 * GATT service/characteristic inspection so the Xstream remote protocol can be
 * identified from the device itself instead of guessed.
 */
@CapacitorPlugin(
        name = "XstreamGatt",
        permissions = {
                @Permission(alias = "nearby", strings = {
                        "android.permission.BLUETOOTH_SCAN",
                        "android.permission.BLUETOOTH_CONNECT",
                        Manifest.permission.ACCESS_FINE_LOCATION
                })
        })
public class XstreamGattPlugin extends Plugin {
    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private ScanCallback leCallback;
    private BroadcastReceiver classicReceiver;
    private boolean scanning;

    private BluetoothGatt gatt;
    private String gattAddress;
    private String gattState = "disconnected";
    private final Map<String, BluetoothGattCharacteristic> characteristics = new LinkedHashMap<>();
    private final Map<String, JSObject> devices = new LinkedHashMap<>();
    private final List<String> log = new ArrayList<>();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean scanAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return granted(Manifest.permission.ACCESS_FINE_LOCATION);
        return granted("android.permission.BLUETOOTH_SCAN");
    }

    private boolean connectAllowed() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted("android.permission.BLUETOOTH_CONNECT");
    }

    private void note(String line) {
        synchronized (log) {
            log.add(line);
            if (log.size() > 120) log.remove(0);
        }
    }

    @PluginMethod public void permissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("scan", scanAllowed());
        result.put("connect", connectAllowed());
        result.put("bluetoothOn", adapter != null && adapter.isEnabled());
        result.put("supported", adapter != null);
        call.resolve(result);
    }

    @PluginMethod public void requestPermissions(PluginCall call) {
        requestPermissionForAlias("nearby", call, "afterPermission");
    }

    @PermissionCallback private void afterPermission(PluginCall call) {
        permissions(call);
    }

    // ----------------------------------------------------------------- scanning

    @PluginMethod public void startScan(PluginCall call) {
        if (adapter == null) { call.reject("This phone has no Bluetooth adapter"); return; }
        if (!adapter.isEnabled()) { call.reject("Turn Bluetooth on to search for the Xstream box"); return; }
        if (!scanAllowed()) { call.reject("Bluetooth scan permission is required"); return; }
        synchronized (devices) { devices.clear(); }

        main.post(() -> {
            try {
                if (connectAllowed()) {
                    for (BluetoothDevice bonded : adapter.getBondedDevices()) publish(bonded, "bonded", null, null);
                }
                startClassic();
                startLe();
                scanning = true;
                note("scan started");
                JSObject result = new JSObject();
                result.put("scanning", true);
                call.resolve(result);
            } catch (Exception error) { call.reject(message(error)); }
        });
    }

    private void startClassic() {
        if (!connectAllowed()) return;
        if (classicReceiver == null) {
            classicReceiver = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    if (!BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) return;
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE);
                    if (device != null) publish(device, "classic", rssi == Short.MIN_VALUE ? null : (int) rssi, null);
                }
            };
            IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.registerReceiver(getContext(), classicReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(classicReceiver, filter);
            }
        }
        try { if (adapter.isDiscovering()) adapter.cancelDiscovery(); } catch (Exception ignored) {}
        try { adapter.startDiscovery(); } catch (Exception ignored) {}
    }

    private void startLe() {
        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) return;
        leCallback = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult result) { handle(result); }
            @Override public void onBatchScanResults(List<ScanResult> results) { for (ScanResult r : results) handle(r); }
            @Override public void onScanFailed(int code) { note("BLE scan failed: " + code); }

            private void handle(ScanResult result) {
                List<String> services = new ArrayList<>();
                if (result.getScanRecord() != null && result.getScanRecord().getServiceUuids() != null) {
                    for (ParcelUuid uuid : result.getScanRecord().getServiceUuids()) services.add(uuid.getUuid().toString());
                }
                String advertised = result.getScanRecord() == null ? null : result.getScanRecord().getDeviceName();
                publish(result.getDevice(), "ble", result.getRssi(), services, advertised);
            }
        };
        ScanSettings.Builder settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                    .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
                    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES);
        }
        try {
            scanner.startScan(new ArrayList<ScanFilter>(), settings.build(), leCallback);
        } catch (Exception error) { note("BLE start error: " + message(error)); }
    }

    private void publish(BluetoothDevice device, String via, Integer rssi, List<String> services) {
        publish(device, via, rssi, services, null);
    }

    private void publish(BluetoothDevice device, String via, Integer rssi, List<String> services, String advertised) {
        if (device == null) return;
        String address = device.getAddress();
        String name = advertised;
        try { if (connectAllowed() && device.getName() != null) name = device.getName(); } catch (Exception ignored) {}
        JSObject item = new JSObject();
        item.put("id", address);
        item.put("address", address);
        item.put("name", name == null || name.isEmpty() ? "Unnamed device" : name);
        item.put("via", via);
        if (rssi != null) item.put("rssi", rssi);
        try { item.put("bonded", device.getBondState() == BluetoothDevice.BOND_BONDED); } catch (Exception ignored) {}
        try { item.put("type", typeLabel(device.getType())); } catch (Exception ignored) {}
        if (services != null && !services.isEmpty()) {
            JSArray list = new JSArray();
            for (String uuid : services) list.put(uuid);
            item.put("services", list);
        }
        synchronized (devices) {
            JSObject previous = devices.get(address);
            if (previous != null && item.optString("name", "").equals("Unnamed device")) {
                item.put("name", previous.optString("name", "Unnamed device"));
            }
            devices.put(address, item);
        }
        notifyListeners("scanResult", item);
    }

    private static String typeLabel(int type) {
        switch (type) {
            case BluetoothDevice.DEVICE_TYPE_CLASSIC: return "classic";
            case BluetoothDevice.DEVICE_TYPE_LE: return "ble";
            case BluetoothDevice.DEVICE_TYPE_DUAL: return "dual";
            default: return "unknown";
        }
    }

    @PluginMethod public void stopScan(PluginCall call) {
        main.post(() -> {
            stopScanning();
            call.resolve();
        });
    }

    private void stopScanning() {
        scanning = false;
        try { if (scanner != null && leCallback != null) scanner.stopScan(leCallback); } catch (Exception ignored) {}
        leCallback = null;
        try { if (adapter != null && connectAllowed() && adapter.isDiscovering()) adapter.cancelDiscovery(); } catch (Exception ignored) {}
        try { if (classicReceiver != null) getContext().unregisterReceiver(classicReceiver); } catch (Exception ignored) {}
        classicReceiver = null;
        note("scan stopped");
    }

    @PluginMethod public void devices(PluginCall call) {
        JSArray list = new JSArray();
        synchronized (devices) { for (JSObject item : devices.values()) list.put(item); }
        JSObject result = new JSObject();
        result.put("devices", list);
        result.put("scanning", scanning);
        call.resolve(result);
    }

    // ------------------------------------------------------------------ bonding

    /** Starts the real Android bonding flow; the system shows/handles the PIN. */
    @PluginMethod public void bond(PluginCall call) {
        String address = call.getString("address");
        if (adapter == null || address == null) { call.reject("Bluetooth address is missing"); return; }
        if (!connectAllowed()) { call.reject("Bluetooth connect permission is required"); return; }
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() == BluetoothDevice.BOND_BONDED) {
                JSObject result = new JSObject(); result.put("bonded", true); call.resolve(result); return;
            }
            boolean started = device.createBond();
            note("bond requested for " + address + " -> " + started);
            JSObject result = new JSObject();
            result.put("bonded", false);
            result.put("started", started);
            call.resolve(result);
        } catch (Exception error) { call.reject(message(error)); }
    }

    // --------------------------------------------------------------------- GATT

    @PluginMethod public void connect(PluginCall call) {
        String address = call.getString("address");
        if (adapter == null || address == null) { call.reject("Bluetooth address is missing"); return; }
        if (!connectAllowed()) { call.reject("Bluetooth connect permission is required"); return; }
        main.post(() -> {
            try {
                closeGatt();
                BluetoothDevice device = adapter.getRemoteDevice(address);
                gattAddress = address;
                gattState = "connecting";
                emitState(null);
                int transport = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? BluetoothDevice.TRANSPORT_AUTO : 0;
                gatt = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? device.connectGatt(getContext(), true, callback, transport)
                        : device.connectGatt(getContext(), true, callback);
                JSObject result = new JSObject();
                result.put("connecting", gatt != null);
                call.resolve(result);
            } catch (Exception error) { call.reject(message(error)); }
        });
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            gattState = newState == BluetoothProfile.STATE_CONNECTED ? "connected" : "disconnected";
            note("GATT state " + gattState + " (status " + status + ")");
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                try { g.discoverServices(); } catch (Exception ignored) {}
            }
            emitState(null);
        }

        @Override public void onServicesDiscovered(BluetoothGatt g, int status) {
            characteristics.clear();
            JSArray services = new JSArray();
            for (BluetoothGattService service : g.getServices()) {
                JSObject entry = new JSObject();
                entry.put("uuid", service.getUuid().toString());
                JSArray chars = new JSArray();
                for (BluetoothGattCharacteristic characteristic : service.getCharacteristics()) {
                    characteristics.put(characteristic.getUuid().toString(), characteristic);
                    JSObject item = new JSObject();
                    item.put("uuid", characteristic.getUuid().toString());
                    JSArray props = new JSArray();
                    int p = characteristic.getProperties();
                    if ((p & BluetoothGattCharacteristic.PROPERTY_READ) != 0) props.put("READ");
                    if ((p & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) props.put("WRITE");
                    if ((p & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) props.put("WRITE_NO_RESPONSE");
                    if ((p & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) props.put("NOTIFY");
                    if ((p & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) props.put("INDICATE");
                    item.put("properties", props);
                    chars.put(item);
                }
                entry.put("characteristics", chars);
                services.put(entry);
            }
            note("discovered " + g.getServices().size() + " services");
            emitState(services);
        }

        @Override public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            emitValue("read", c.getUuid().toString(), c.getValue());
        }

        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            emitValue("notify", c.getUuid().toString(), c.getValue());
        }

        @Override public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            note("write status " + status + " on " + c.getUuid());
        }
    };

    private void emitValue(String kind, String uuid, byte[] value) {
        JSObject event = new JSObject();
        event.put("kind", kind);
        event.put("uuid", uuid);
        event.put("hex", hex(value));
        note(kind + " " + uuid + " = " + hex(value));
        notifyListeners("gattValue", event);
    }

    private void emitState(JSArray services) {
        JSObject event = new JSObject();
        event.put("state", gattState);
        event.put("address", gattAddress);
        if (services != null) event.put("services", services);
        notifyListeners("gattState", event);
    }

    @PluginMethod public void discoverServices(PluginCall call) {
        if (gatt == null) { call.reject("Connect to a device first"); return; }
        main.post(() -> {
            try { gatt.discoverServices(); call.resolve(); }
            catch (Exception error) { call.reject(message(error)); }
        });
    }

    @PluginMethod public void readCharacteristic(PluginCall call) {
        BluetoothGattCharacteristic characteristic = pick(call);
        if (characteristic == null) return;
        main.post(() -> {
            try { gatt.readCharacteristic(characteristic); call.resolve(); }
            catch (Exception error) { call.reject(message(error)); }
        });
    }

    @PluginMethod public void writeCharacteristic(PluginCall call) {
        BluetoothGattCharacteristic characteristic = pick(call);
        if (characteristic == null) return;
        String payload = call.getString("hex", "");
        main.post(() -> {
            try {
                characteristic.setValue(bytes(payload));
                boolean noResponse = (characteristic.getProperties()
                        & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0;
                characteristic.setWriteType(noResponse
                        ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                        : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                boolean ok = gatt.writeCharacteristic(characteristic);
                note("write " + payload + " -> " + ok);
                JSObject result = new JSObject(); result.put("sent", ok); call.resolve(result);
            } catch (Exception error) { call.reject(message(error)); }
        });
    }

    @PluginMethod public void enableNotify(PluginCall call) {
        BluetoothGattCharacteristic characteristic = pick(call);
        if (characteristic == null) return;
        main.post(() -> {
            try {
                gatt.setCharacteristicNotification(characteristic, true);
                BluetoothGattDescriptor descriptor = characteristic.getDescriptor(
                        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"));
                if (descriptor != null) {
                    boolean indicate = (characteristic.getProperties()
                            & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0;
                    descriptor.setValue(indicate
                            ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                            : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(descriptor);
                }
                call.resolve();
            } catch (Exception error) { call.reject(message(error)); }
        });
    }

    private BluetoothGattCharacteristic pick(PluginCall call) {
        if (gatt == null) { call.reject("Connect to a device first"); return null; }
        String uuid = call.getString("uuid");
        BluetoothGattCharacteristic characteristic = uuid == null ? null : characteristics.get(uuid);
        if (characteristic == null) { call.reject("Unknown characteristic — run Discover services first"); return null; }
        return characteristic;
    }

    @PluginMethod public void disconnect(PluginCall call) {
        main.post(() -> { closeGatt(); call.resolve(); });
    }

    @PluginMethod public void diagnostics(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", gattState);
        result.put("address", gattAddress);
        result.put("scanning", scanning);
        result.put("bluetoothOn", adapter != null && adapter.isEnabled());
        result.put("adapterName", adapter == null ? null : safeName());
        JSArray lines = new JSArray();
        synchronized (log) { for (String line : log) lines.put(line); }
        result.put("log", lines);
        call.resolve(result);
    }

    private String safeName() {
        try { return adapter.getName(); } catch (Exception ignored) { return null; }
    }

    private void closeGatt() {
        try { if (gatt != null) { gatt.disconnect(); gatt.close(); } } catch (Exception ignored) {}
        gatt = null;
        characteristics.clear();
        gattState = "disconnected";
    }

    private static String hex(byte[] value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder();
        for (byte b : value) out.append(String.format("%02x", b));
        return out.toString();
    }

    private static byte[] bytes(String value) {
        String clean = value == null ? "" : value.replaceAll("[^0-9a-fA-F]", "");
        if ((clean.length() & 1) != 0) clean = "0" + clean;
        byte[] out = new byte[clean.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    private static String message(Exception error) {
        String text = error.getMessage();
        return text == null ? error.getClass().getSimpleName() : text;
    }

    @Override protected void handleOnDestroy() {
        stopScanning();
        closeGatt();
        super.handleOnDestroy();
    }
}
