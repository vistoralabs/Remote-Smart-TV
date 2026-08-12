package app.remote.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.text.SimpleDateFormat;
import java.util.Date;

import javax.net.ssl.SSLSocket;

@CapacitorPlugin(name = "NativeAndroidTv")
public class NativeAndroidTvPlugin extends Plugin {
    private static final String PREFS_NAME = "atv_paired_device_v1";
    private static final String KEY_PAIRED_ADDRESS = "paired_address";
    private static final String KEY_PAIRED_NAME = "paired_name";
    private static final String KEY_PAIRED_TIME = "paired_time";

    private final ExecutorService io = Executors.newCachedThreadPool();
    private AtvIdentity identity;
    private AtvTls tls;
    private SSLSocket pairingSocket;
    private X509Certificate pairingServerCertificate;
    private String pairingHost;
    private SSLSocket remoteSocket;
    private String remoteHost;
    private Thread remoteReader;
    private volatile CountDownLatch remoteReady = new CountDownLatch(1);
    private volatile boolean remoteStarted;
    private static final long CLIENT_REMOTE_FEATURES = 1L | 2L | 32L | 64L | 512L;
    private volatile long remoteFeatures;
    private final Object remoteLock = new Object();
    private final List<String> debugLog = new CopyOnWriteArrayList<>();
    private volatile String pairingStage = "idle";
    private volatile String remoteFailure;

    private volatile boolean isReconnecting = false;
    private volatile int reconnectAttempt = 0;
    private volatile String lastError = null;

    @Override
    public void load() {
        identity = new AtvIdentity(getContext());
        tls = new AtvTls(identity);

        String savedAddress = getSavedAddress();
        if (savedAddress != null) {
            log("INIT", "[ATV] Restored saved pairing: " + savedAddress + " (" + getSavedName() + ")");
            triggerAutoReconnect();
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        String savedAddress = getSavedAddress();
        if (savedAddress != null && !isConnected()) {
            log("LIFECYCLE", "[ATV] App resumed: triggering auto-reconnect to " + savedAddress);
            triggerAutoReconnect();
        }
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String getSavedAddress() {
        return getPrefs().getString(KEY_PAIRED_ADDRESS, null);
    }

    private String getSavedName() {
        return getPrefs().getString(KEY_PAIRED_NAME, "Android TV");
    }

    private void savePairedDevice(String address, String name) {
        getPrefs().edit()
                .putString(KEY_PAIRED_ADDRESS, address)
                .putString(KEY_PAIRED_NAME, name != null ? name : address)
                .putLong(KEY_PAIRED_TIME, System.currentTimeMillis())
                .apply();
        log("PREFS", "[ATV] Saved paired device: " + address + " (" + name + ")");
    }

    private void clearSavedPairingInternal() {
        getPrefs().edit().clear().apply();
        log("PREFS", "[ATV] Saved pairing cleared");
    }

    private boolean isConnected() {
        synchronized (remoteLock) {
            return remoteSocket != null && remoteSocket.isConnected() && !remoteSocket.isClosed() && remoteStarted;
        }
    }

    private synchronized void triggerAutoReconnect() {
        String address = getSavedAddress();
        if (address == null || isConnected() || isReconnecting) return;
        isReconnecting = true;
        io.execute(this::autoReconnectLoop);
    }

    private void autoReconnectLoop() {
        long[] backoffs = {2000L, 4000L, 8000L, 15000L, 30000L};
        int backoffIdx = 0;

        try {
            while (getSavedAddress() != null && !isConnected()) {
                String targetHost = getSavedAddress();
                reconnectAttempt++;
                log("RECONNECT", "[ATV] Reconnect attempt #" + reconnectAttempt + " to " + targetHost);
                try {
                    ensureRemote(targetHost);
                    if (isConnected()) {
                        log("RECONNECT", "[ATV] Session successfully restored to " + targetHost);
                        reconnectAttempt = 0;
                        lastError = null;
                        break;
                    }
                } catch (Exception error) {
                    String cleanErr = clean(error);
                    lastError = cleanErr;
                    log("RECONNECT_ERR", "[ATV] Reconnect failed: " + cleanErr);

                    // If certificate authentication permanently failed or TV rejected pairing, clear pairing
                    if (cleanErr.contains("rejected by the TV") || cleanErr.contains("certificate authentication failed")) {
                        log("RECONNECT_ERR", "[ATV] TV explicitly rejected identity certificate; clearing saved pairing");
                        clearSavedPairingInternal();
                        closeRemote();
                        break;
                    }

                    // If host is unreachable, try mDNS rediscovery to update DHCP IP
                    if (reconnectAttempt >= 2 && reconnectAttempt % 3 == 0) {
                        log("REDISCOVERY", "[ATV] Saved IP " + targetHost + " unreachable. Scanning for updated DHCP IP...");
                        try {
                            Map<String, String> found = new ConcurrentHashMap<>();
                            mdnsDiscover(found);
                            String savedName = getSavedName();
                            for (Map.Entry<String, String> entry : found.entrySet()) {
                                if (entry.getValue() != null && entry.getValue().equalsIgnoreCase(savedName)) {
                                    String newIp = entry.getKey();
                                    log("REDISCOVERY", "[ATV] Found paired device '" + savedName + "' at new IP: " + newIp);
                                    savePairedDevice(newIp, savedName);
                                    targetHost = newIp;
                                    break;
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }

                long delay = backoffs[Math.min(backoffIdx, backoffs.length - 1)];
                backoffIdx++;
                Thread.sleep(delay);
            }
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        } finally {
            isReconnecting = false;
        }
    }

    /**
     * Discovers Android TV / Google TV / Xstream boxes.
     */
    @PluginMethod
    public void scan(PluginCall call) {
        log("SCAN", "Started TV discovery");
        io.execute(() -> {
            try {
                Map<String, String> found = new ConcurrentHashMap<>();
                try { mdnsDiscover(found); } catch (Exception ignored) {}
                String prefix = localPrefix();
                if (prefix == null && found.isEmpty())
                    throw new Exception("Connect this phone and the Xstream box to the same Wi-Fi network");
                if (prefix != null) {
                    ExecutorService pool = Executors.newFixedThreadPool(48);
                    List<String[]> hits = new CopyOnWriteArrayList<>();
                    for (int i = 1; i < 255; i++) {
                        String host = prefix + i;
                        pool.execute(() -> {
                            if (portOpen(host, 6466, 300) || portOpen(host, 6467, 300)) {
                                String name = host;
                                try {
                                    String canonical = InetAddress.getByName(host).getCanonicalHostName();
                                    if (!canonical.equals(host)) name = canonical;
                                } catch (Exception ignored) {}
                                hits.add(new String[] { host, name });
                            }
                        });
                    }
                    pool.shutdown();
                    pool.awaitTermination(14, TimeUnit.SECONDS);
                    for (String[] hit : hits) if (!found.containsKey(hit[0])) found.put(hit[0], hit[1]);
                }
                JSArray devices = new JSArray();
                for (Map.Entry<String, String> entry : new LinkedHashMap<>(found).entrySet()) {
                    JSObject item = new JSObject();
                    item.put("address", entry.getKey());
                    item.put("name", entry.getValue());
                    devices.put(item);
                }
                JSObject result = new JSObject();
                result.put("devices", devices);
                result.put("localIp", prefix == null ? null : prefix + "x");
                log("SCAN", "Finished: " + found.size() + " device(s)");
                call.resolve(result);
            } catch (Exception error) { log("SCAN_ERROR", clean(error)); call.reject(clean(error)); }
        });
    }

    private void mdnsDiscover(Map<String, String> found) throws Exception {
        NsdManager nsd = (NsdManager) getContext().getApplicationContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) return;
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiManager.MulticastLock lock = wifi == null ? null : wifi.createMulticastLock("atv-mdns");
        if (lock != null) { lock.setReferenceCounted(true); lock.acquire(); }
        final NsdManager.DiscoveryListener[] holder = new NsdManager.DiscoveryListener[1];
        try {
            NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
                @Override public void onStartDiscoveryFailed(String type, int code) {}
                @Override public void onStopDiscoveryFailed(String type, int code) {}
                @Override public void onDiscoveryStarted(String type) {}
                @Override public void onDiscoveryStopped(String type) {}
                @Override public void onServiceLost(NsdServiceInfo info) {}
                @Override public void onServiceFound(NsdServiceInfo info) {
                    nsd.resolveService(info, new NsdManager.ResolveListener() {
                        @Override public void onResolveFailed(NsdServiceInfo failed, int code) {}
                        @Override public void onServiceResolved(NsdServiceInfo resolved) {
                            InetAddress host = resolved.getHost();
                            if (host == null) return;
                            String name = resolved.getServiceName();
                            found.put(host.getHostAddress(), name == null || name.isEmpty() ? host.getHostAddress() : name);
                        }
                    });
                }
            };
            holder[0] = listener;
            nsd.discoverServices("_androidtvremote2._tcp", NsdManager.PROTOCOL_DNS_SD, listener);
            Thread.sleep(5000);
        } finally {
            try { if (holder[0] != null) nsd.stopServiceDiscovery(holder[0]); } catch (Exception ignored) {}
            if (lock != null) try { lock.release(); } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void startPairing(PluginCall call) {
        String host = call.getString("address");
        if (host == null || host.trim().isEmpty()) { call.reject("TV IP address is missing"); return; }
        io.execute(() -> {
            closePairing();
            try {
                pairingHost = host.trim();
                pairingStage = "connecting to " + pairingHost + ":6467";
                log("PAIR", pairingStage);
                pairingSocket = tls.connect(pairingHost, 6467);
                pairingStage = "TLS connected";
                log("PAIR", pairingStage);
                pairingServerCertificate = (X509Certificate) pairingSocket.getSession().getPeerCertificates()[0];
                OutputStream out = pairingSocket.getOutputStream();
                byte[] request = AtvProto.join(AtvProto.string(1, "Smart TV Remote"), AtvProto.string(2, "Android"));
                write(out, pairingEnvelope(AtvProto.bytes(10, request)));
                expect(pairingSocket, 11);
                pairingStage = "pairing request accepted";
                log("PAIR", pairingStage);
                byte[] encoding = AtvProto.join(AtvProto.field(1, 3), AtvProto.field(2, 6));
                byte[] options = AtvProto.join(AtvProto.bytes(1, encoding), AtvProto.field(3, 1));
                write(out, pairingEnvelope(AtvProto.bytes(20, options)));
                expect(pairingSocket, 20);
                pairingStage = "encoding accepted";
                log("PAIR", pairingStage);
                byte[] config = AtvProto.join(AtvProto.bytes(1, encoding), AtvProto.field(2, 1));
                write(out, pairingEnvelope(AtvProto.bytes(30, config)));
                expect(pairingSocket, 31);
                pairingStage = "waiting for TV code";
                log("PAIR", pairingStage);
                JSObject result = new JSObject(); result.put("codeRequired", true); call.resolve(result);
            } catch (Exception error) { pairingStage = "failed: " + clean(error); log("PAIR_ERROR", pairingStage); closePairing(); call.reject("Pairing could not start: " + clean(error)); }
        });
    }

    @PluginMethod
    public void finishPairing(PluginCall call) {
        String code = call.getString("code");
        if (pairingSocket == null || pairingServerCertificate == null) { call.reject("Start pairing first"); return; }
        if (code == null || !code.trim().matches("(?i)[0-9a-f]{6}")) { call.reject("Enter the 6-character code shown on the TV"); return; }
        io.execute(() -> {
            try {
                String host = pairingHost;
                byte[] secret = pairingSecret(code.trim().toUpperCase(Locale.US));
                write(pairingSocket.getOutputStream(), pairingEnvelope(AtvProto.bytes(40, AtvProto.bytes(1, secret))));
                expect(pairingSocket, 41);
                pairingStage = "paired";
                log("PAIR", "TV accepted the code; certificate persisted for reuse");
                closePairing();
                if (host == null) throw new Exception("TV address was lost after pairing");

                savePairedDevice(host, host);
                ensureRemote(host);

                JSObject result = new JSObject(); result.put("paired", true); call.resolve(result);
            } catch (Exception error) {
                pairingStage = "paired, remote failed: " + clean(error);
                log("REMOTE_ERROR", pairingStage);
                closePairing();
                call.reject("TV accepted the code, but remote connection failed: " + clean(error));
            }
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        String savedAddress = getSavedAddress();
        boolean paired = savedAddress != null;
        if (paired && !isConnected()) {
            triggerAutoReconnect();
        }
        JSObject result = new JSObject();
        result.put("paired", paired);
        result.put("connected", isConnected());
        result.put("address", savedAddress);
        result.put("name", getSavedName());
        result.put("reconnecting", isReconnecting);
        result.put("lastError", lastError);
        call.resolve(result);
    }

    @PluginMethod
    public void clearPairing(PluginCall call) {
        clearSavedPairingInternal();
        closeRemote();
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("address");
        if (host == null) host = getSavedAddress();
        if (host == null) { call.reject("TV IP address is missing"); return; }
        final String target = host.trim();
        io.execute(() -> {
            try {
                ensureRemote(target);
                savePairedDevice(target, target);
                JSObject result = new JSObject(); result.put("connected", true); call.resolve(result);
            } catch (Exception error) {
                lastError = clean(error);
                call.reject("Remote connection failed: " + clean(error));
            }
        });
    }

    @PluginMethod
    public void sendKey(PluginCall call) {
        String host = call.getString("address");
        if (host == null) host = getSavedAddress();
        String key = call.getString("key");
        if (host == null || key == null) { call.reject("TV or key is missing"); return; }
        final String target = host.trim();
        io.execute(() -> {
            try {
                int code = keyCode(key);
                if (code < 0) throw new Exception("This button is not supported by Android TV");
                ensureRemote(target);
                byte[] inject = AtvProto.join(AtvProto.field(1, code), AtvProto.field(2, 3));
                synchronized (remoteLock) { write(remoteSocket.getOutputStream(), AtvProto.bytes(10, inject)); }
                log("REMOTE_KEY", key.toUpperCase(Locale.US) + " sent (keyCode=" + code + ", direction=SHORT)");
                JSObject result = new JSObject(); result.put("sent", true); call.resolve(result);
            } catch (Exception error) {
                lastError = clean(error);
                call.reject(clean(error));
            }
        });
    }

    @PluginMethod
    public void sendText(PluginCall call) {
        String host = call.getString("address");
        if (host == null) host = getSavedAddress();
        String text = call.getString("text");
        if (host == null || text == null) { call.reject("TV or text is missing"); return; }
        final String target = host.trim();
        io.execute(() -> {
            try {
                log("INPUT", "sending text: \"" + text + "\" (" + text.length() + " chars)");
                ensureRemote(target);
                int sent = 0, skipped = 0;
                for (char character : text.toCharArray()) {
                    int[] stroke = charCode(character);
                    if (stroke == null) { skipped++; continue; }
                    injectKey(stroke[0], stroke[1] == 1);
                    sent++;
                    Thread.sleep(35);
                }
                JSObject result = new JSObject(); result.put("sent", true); result.put("keys", sent); call.resolve(result);
            } catch (Exception error) { lastError = clean(error); call.reject(clean(error)); }
        });
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String host = call.getString("address");
        if (host == null) host = getSavedAddress();
        String link = call.getString("link");
        if (host == null || link == null || link.trim().isEmpty()) { call.reject("TV or app link is missing"); return; }
        final String target = host.trim();
        io.execute(() -> {
            try {
                ensureRemote(target);
                byte[] request = AtvProto.bytes(90, AtvProto.string(1, link.trim()));
                synchronized (remoteLock) { write(remoteSocket.getOutputStream(), request); }
                JSObject result = new JSObject(); result.put("sent", true); call.resolve(result);
            } catch (Exception error) { lastError = clean(error); call.reject(clean(error)); }
        });
    }

    @PluginMethod
    public void state(PluginCall call) {
        JSObject result = new JSObject();
        boolean live = isConnected();
        String savedAddr = getSavedAddress();
        synchronized (remoteLock) {
            result.put("host", remoteHost != null ? remoteHost : savedAddr);
        }
        result.put("connected", live);
        result.put("paired", savedAddr != null);
        result.put("address", savedAddr != null ? savedAddr : remoteHost);
        result.put("name", getSavedName());
        result.put("reconnecting", isReconnecting);
        result.put("reconnectAttempts", reconnectAttempt);
        result.put("lastError", lastError);
        result.put("pairing", pairingSocket != null);
        result.put("localIp", localPrefix() == null ? null : localPrefix() + "x");
        result.put("certificate", identity != null);
        call.resolve(result);
    }

    @PluginMethod
    public void diagnostics(PluginCall call) {
        JSObject result = new JSObject();
        boolean live = isConnected();
        String savedAddr = getSavedAddress();
        synchronized (remoteLock) {
            result.put("currentHost", remoteHost);
        }
        result.put("paired", savedAddr != null);
        result.put("connected", live);
        result.put("savedHost", savedAddr);
        result.put("reconnectAttempt", reconnectAttempt);
        result.put("lastError", lastError);
        result.put("identity", identity != null ? "available" : "missing");
        result.put("appVersion", "2.7");
        result.put("time", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
        String prefix = localPrefix();
        result.put("localIp", prefix == null ? null : prefix + "x");
        result.put("pairingStage", pairingStage);
        result.put("pairing", pairingSocket != null && !pairingSocket.isClosed());
        JSArray entries = new JSArray();
        for (String entry : debugLog) entries.put(entry);
        result.put("log", entries);
        call.resolve(result);
    }

    @PluginMethod
    public void clearDiagnostics(PluginCall call) {
        debugLog.clear();
        pairingStage = "idle";
        lastError = null;
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeRemote();
        call.resolve();
    }

    private void injectKey(int code, boolean shift) throws Exception {
        if (shift) sendStroke(59, 1);
        sendStroke(code, 1);
        sendStroke(code, 2);
        if (shift) sendStroke(59, 2);
    }

    private void sendStroke(int code, int action) throws Exception {
        byte[] inject = AtvProto.join(AtvProto.field(1, code), AtvProto.field(2, action));
        synchronized (remoteLock) { write(remoteSocket.getOutputStream(), AtvProto.bytes(10, inject)); }
    }

    private static int[] charCode(char character) {
        if (character >= 'a' && character <= 'z') return new int[] { 29 + (character - 'a'), 0 };
        if (character >= 'A' && character <= 'Z') return new int[] { 29 + (character - 'A'), 1 };
        if (character >= '0' && character <= '9') return new int[] { 7 + (character - '0'), 0 };
        switch (character) {
            case ' ': return new int[] { 62, 0 };
            case '\n': return new int[] { 66, 0 };
            case '.': return new int[] { 56, 0 };
            case ',': return new int[] { 55, 0 };
            case '-': return new int[] { 69, 0 };
            case '@': return new int[] { 77, 0 };
            case '/': return new int[] { 76, 0 };
            case '\'': return new int[] { 75, 0 };
            case ';': return new int[] { 74, 0 };
            case '+': return new int[] { 81, 0 };
            case '=': return new int[] { 70, 0 };
            case '_': return new int[] { 69, 1 };
            case ':': return new int[] { 74, 1 };
            case '?': return new int[] { 76, 1 };
            case '!': return new int[] { 8, 1 };
            case '#': return new int[] { 18, 0 };
            case '*': return new int[] { 17, 0 };
            default: return null;
        }
    }

    private void ensureRemote(String host) throws Exception {
        synchronized (remoteLock) {
            if (remoteSocket != null && remoteSocket.isConnected() && !remoteSocket.isClosed()
                    && host.equals(remoteHost) && remoteStarted) return;
            closeRemote();
            log("REMOTE", "starting 6466 connection to " + host);
            try {
                X509Certificate mine = identity.certificate();
                log("REMOTE", "client certificate loaded (" + mine.getSubjectDN() + ")");
            } catch (Exception error) {
                throw new Exception("client certificate could not be loaded: " + clean(error));
            }
            try {
                remoteSocket = tls.connect(host, 6466);
            } catch (Exception error) {
                throw new Exception("TLS connect to " + host + ":6466 failed: " + clean(error));
            }
            log("REMOTE", "TLS connected");
            try {
                remoteSocket.getSession().getPeerCertificates();
                if (!remoteSocket.getSession().isValid())
                    throw new Exception("TLS session was rejected by the TV");
                log("REMOTE", "certificate authentication successful");
            } catch (Exception error) {
                throw new Exception("certificate authentication failed on 6466: " + clean(error));
            }
            remoteSocket.setSoTimeout(0);
            remoteHost = host;
            remoteStarted = false;
            remoteFeatures = 0;
            remoteFailure = null;
            remoteReady = new CountDownLatch(1);
            SSLSocket socket = remoteSocket;
            remoteReader = new Thread(() -> remoteLoop(socket), "android-tv-remote-reader");
            remoteReader.start();
        }
        if (!remoteReady.await(12, TimeUnit.SECONDS)) {
            String reason = remoteFailure;
            closeRemote();
            throw new Exception(reason != null ? reason
                    : "remote handshake timed out: TV never sent RemoteStart on 6466");
        }
        if (!remoteStarted) {
            String reason = remoteFailure;
            throw new Exception(reason != null ? reason : "TV closed the 6466 remote session during handshake");
        }
    }

    private void remoteLoop(SSLSocket socket) {
        try {
            while (!socket.isClosed()) {
                byte[] message = AtvProto.readFrame(socket.getInputStream());
                int field = AtvProto.firstField(message);
                byte[] reply = null;
                if (field == 1) {
                    byte[] configure = AtvProto.nested(message, 1);
                    long tvFeatures = AtvProto.firstVarint(configure, 1);
                    if (tvFeatures < 0) throw new Exception("TV remote_configure did not include a feature mask");
                    remoteFeatures = tvFeatures & CLIENT_REMOTE_FEATURES;
                    if ((remoteFeatures & 2L) == 0)
                        throw new Exception("TV does not advertise remote key support (features=" + tvFeatures + ")");
                    byte[] info = AtvProto.join(
                            AtvProto.field(3, 1),
                            AtvProto.string(4, "1"),
                            AtvProto.string(5, "app.remote.universal"),
                            AtvProto.string(6, "2.7"));
                    reply = AtvProto.bytes(1, AtvProto.join(AtvProto.field(1, remoteFeatures), AtvProto.bytes(2, info)));
                    log("REMOTE", "remote_configure received; TV features=" + tvFeatures
                            + ", negotiated features=" + remoteFeatures);
                } else if (field == 2) {
                    if (remoteFeatures == 0) throw new Exception("TV sent remote_set_active before remote_configure");
                    reply = AtvProto.bytes(2, AtvProto.field(1, remoteFeatures));
                    log("REMOTE", "remote_set_active received; replying active=" + remoteFeatures);
                } else if (field == 3) {
                    byte[] error = AtvProto.nested(message, 3);
                    byte[] rejected = AtvProto.nested(error, 2);
                    int rejectedField = rejected.length == 0 ? -1 : AtvProto.firstField(rejected);
                    String detail = rejectedField < 0
                            ? "TV reported remote_error without rejected-message details"
                            : "TV rejected RemoteMessage field " + rejectedField;
                    log("REMOTE_ERROR", detail);
                    if (!remoteStarted) {
                        remoteFailure = detail + " during handshake";
                        remoteReady.countDown();
                    }
                } else if (field == 8) {
                    byte[] ping = AtvProto.nested(message, 8);
                    long value = AtvProto.firstVarint(ping, 1);
                    reply = AtvProto.bytes(9, AtvProto.field(1, value < 0 ? 0 : value));
                } else if (field == 40) {
                    remoteStarted = true;
                    remoteReady.countDown();
                    log("REMOTE", "remote protocol handshake complete");
                    log("REMOTE", "CONNECTED");
                }
                if (reply != null) synchronized (remoteLock) { write(socket.getOutputStream(), reply); }
            }
        } catch (Exception error) {
            if (remoteFailure == null) remoteFailure = "6466 session error: " + clean(error);
            log("REMOTE_ERROR", remoteFailure);
            remoteReady.countDown();
            if (socket == remoteSocket) closeRemote();
        }
    }

    private byte[] pairingSecret(String code) throws Exception {
        RSAPublicKey client = (RSAPublicKey) identity.certificate().getPublicKey();
        RSAPublicKey server = (RSAPublicKey) pairingServerCertificate.getPublicKey();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        digest.update(unsigned(client.getModulus())); digest.update(unsigned(client.getPublicExponent()));
        digest.update(unsigned(server.getModulus())); digest.update(unsigned(server.getPublicExponent()));
        digest.update(hex(code.substring(2)));
        byte[] result = digest.digest();
        if ((result[0] & 0xff) != Integer.parseInt(code.substring(0, 2), 16)) throw new Exception("Incorrect pairing code");
        return result;
    }

    private static byte[] unsigned(BigInteger value) {
        String hex = value.toString(16);
        if ((hex.length() & 1) != 0) hex = "0" + hex;
        return hex(hex);
    }
    private static byte[] hex(String value) {
        byte[] out = new byte[value.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        return out;
    }
    private static byte[] pairingEnvelope(byte[] message) { return AtvProto.join(AtvProto.field(1, 2), AtvProto.field(2, 200), message); }
    private static void write(OutputStream out, byte[] payload) throws Exception { out.write(AtvProto.frame(payload)); out.flush(); }
    private static void expect(SSLSocket socket, int field) throws Exception {
        byte[] response = AtvProto.readFrame(socket.getInputStream());
        long status = AtvProto.firstVarint(response, 2);
        if (status != 200) throw new Exception("TV pairing status " + status);
        if (!AtvProto.hasField(response, field))
            throw new Exception("TV sent pairing step " + AtvProto.firstField(response) + " instead of " + field);
    }
    private static boolean portOpen(String host, int port, int timeout) {
        try (Socket socket = new Socket()) { socket.connect(new InetSocketAddress(host, port), timeout); return true; }
        catch (Exception ignored) { return false; }
    }
    private String localPrefix() {
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifi == null) return null;
        int ip = wifi.getConnectionInfo().getIpAddress();
        if (ip == 0) return null;
        return String.format(Locale.US, "%d.%d.%d.", ip & 255, (ip >> 8) & 255, (ip >> 16) & 255);
    }
    private static int keyCode(String key) {
        switch (key) {
            case "home": return 3; case "back": return 4; case "power": return 26;
            case "up": return 19; case "down": return 20; case "left": return 21; case "right": return 22; case "ok": return 23;
            case "volup": return 24; case "voldown": return 25; case "mute": return 164;
            case "menu": return 82; case "chup": return 166; case "chdown": return 167; case "input": return 178;
            case "play": case "pause": return 85; case "rewind": return 89; case "forward": return 90;
            case "info": return 165; case "guide": return 172; case "exit": return 111; case "voice": return 84; case "keyboard": return 66;
            case "enter": return 66; case "backspace": case "delete": return 67; case "space": return 62;
            default: return -1;
        }
    }
    private void log(String area, String message) {
        String time = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(new Date());
        debugLog.add(time + " [" + area + "] " + message);
        while (debugLog.size() > 100) debugLog.remove(0);
    }
    private void closePairing() { try { if (pairingSocket != null) pairingSocket.close(); } catch (Exception ignored) {} pairingSocket = null; pairingServerCertificate = null; pairingHost = null; }
    private void closeRemote() {
        remoteStarted = false;
        remoteFeatures = 0;
        remoteReady.countDown();
        try { if (remoteSocket != null) remoteSocket.close(); } catch (Exception ignored) {}
        remoteSocket = null;
        remoteHost = null;
        remoteReader = null;
    }
    private static String clean(Exception error) { String message = error.getMessage(); return message == null ? error.getClass().getSimpleName() : message; }
    @Override protected void handleOnDestroy() { closePairing(); closeRemote(); io.shutdownNow(); super.handleOnDestroy(); }
}