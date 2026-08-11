package app.remote.universal;

import java.security.SecureRandom;
import java.security.cert.X509Certificate;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.X509TrustManager;

final class AtvTls {
    private final AtvIdentity identity;
    AtvTls(AtvIdentity identity) { this.identity = identity; }

    SSLSocket connect(String host, int port) throws Exception {
        KeyManagerFactory keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        keys.init(identity.store(), identity.password());
        X509TrustManager trust = new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] chain, String authType) {}
            public void checkServerTrusted(X509Certificate[] chain, String authType) {}
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        };
        SSLContext context = SSLContext.getInstance("TLSv1.2");
        context.init(keys.getKeyManagers(), new X509TrustManager[]{trust}, new SecureRandom());
        SSLSocket socket = (SSLSocket) context.getSocketFactory().createSocket(host, port);
        socket.setSoTimeout(12000);
        socket.startHandshake();
        return socket;
    }
}