package app.remote.universal;

/**
 * Single place where every AdMob identifier lives.
 *
 * <p>The ad unit ids come from the build type (see app/build.gradle): release builds
 * compile in the production units, debug builds compile in Google's official test
 * units. A release binary therefore never contains a test ad unit at all.
 */
public final class AdsConfig {

    private AdsConfig() {}

    /** true only in debug/development builds — release always uses production units. */
    public static final boolean USE_TEST_ADS = BuildConfig.AD_TEST_UNITS;

    /** Production application id (also declared in AndroidManifest.xml). */
    public static final String APP_ID = "ca-app-pub-5732060577215447~6117748951";

    public static String bannerUnitId() {
        return BuildConfig.AD_BANNER;
    }

    public static String interstitialUnitId() {
        return BuildConfig.AD_INTERSTITIAL;
    }

    public static String appOpenUnitId() {
        return BuildConfig.AD_APP_OPEN;
    }

    /** Minimum gap between two interstitials, in milliseconds. */
    public static final long INTERSTITIAL_COOLDOWN_MS = 12_000L;

    /** Grace period after launch before the first interstitial may appear. */
    public static final long INTERSTITIAL_STARTUP_GRACE_MS = 0L;

    /** Minimum background time before a returning user sees an App Open ad. */
    public static final long APP_OPEN_MIN_BACKGROUND_MS = 2_000L;

    /** Cool-down between full-screen ads of any kind. */
    public static final long FULLSCREEN_GAP_MS = 8_000L;

    /** App Open ads expire after four hours per Google's guidance. */
    public static final long APP_OPEN_EXPIRY_MS = 4 * 60 * 60 * 1000L;

    /** Google's reserved demo publisher prefix — must never appear in a release build. */
    private static final String DEMO_PREFIX = "ca-app-pub-3940256099942544";

    /** true when the compiled unit id belongs to Google's demo (test) publisher. */
    public static boolean isDemoUnit(String unitId) {
        return unitId != null && unitId.startsWith(DEMO_PREFIX);
    }

    /**
     * Log line for an ad request. Debug builds name the exact unit id being
     * requested; release builds log only the ad format, never an identifier.
     */
    public static String describeRequest(String format, String unitId) {
        if (BuildConfig.DEBUG) return "requesting " + format + " unit " + unitId;
        return "requesting " + format + " ad";
    }
}

