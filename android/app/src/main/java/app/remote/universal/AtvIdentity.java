package app.remote.universal;

import android.content.Context;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Date;

final class AtvIdentity {
    private static final char[] PASSWORD = "smart-tv-remote".toCharArray();
    private static final String ALIAS = "remote";
    private final File file;
    private KeyStore store;
    private X509Certificate certificate;

    AtvIdentity(Context context) { file = new File(context.getFilesDir(), "android-tv-remote-v2.p12"); }

    synchronized KeyStore store() throws Exception { ensure(); return store; }
    synchronized X509Certificate certificate() throws Exception { ensure(); return certificate; }
    char[] password() { return PASSWORD; }

    private void ensure() throws Exception {
        if (store != null) return;
        if (file.exists()) {
            try (FileInputStream input = new FileInputStream(file)) {
                KeyStore loaded = KeyStore.getInstance("PKCS12");
                loaded.load(input, PASSWORD);
                X509Certificate cert = (X509Certificate) loaded.getCertificate(ALIAS);
                PrivateKey key = (PrivateKey) loaded.getKey(ALIAS, PASSWORD);
                if (cert != null && key != null) { store = loaded; certificate = cert; return; }
            } catch (Exception ignored) { file.delete(); }
        }

        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048, new SecureRandom());
        KeyPair pair = generator.generateKeyPair();
        long now = System.currentTimeMillis();
        X500Name name = new X500Name("CN=Smart TV Remote");
        X509v3CertificateBuilder builder = new X509v3CertificateBuilder(
                name, new BigInteger(64, new SecureRandom()), new Date(now - 60000),
                new Date(now + 10L * 365 * 24 * 60 * 60 * 1000), name,
                SubjectPublicKeyInfo.getInstance(pair.getPublic().getEncoded()));
        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(0));
        builder.addExtension(Extension.subjectAlternativeName, false,
                new GeneralNames(new GeneralName(GeneralName.dNSName, "smart-tv-remote.local")));
        X509Certificate cert = new JcaX509CertificateConverter().getCertificate(
                builder.build(new JcaContentSignerBuilder("SHA256withRSA").build(pair.getPrivate())));
        KeyStore created = KeyStore.getInstance("PKCS12");
        created.load(null, null);
        created.setKeyEntry(ALIAS, pair.getPrivate(), PASSWORD, new java.security.cert.Certificate[]{cert});
        try (FileOutputStream output = new FileOutputStream(file)) { created.store(output, PASSWORD); }
        store = created;
        certificate = cert;
    }
}