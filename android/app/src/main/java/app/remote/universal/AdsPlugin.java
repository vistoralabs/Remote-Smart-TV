package app.remote.universal;

import android.app.Activity;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * Native Google Mobile Ads bridge: adaptive bottom banner, pre-loaded interstitial
 * for natural break points, and an App Open ad for background returns.
 *
 * <p>Every ad path fails silently — the remote keeps working when an ad cannot load,
 * and no remote key press is ever blocked while an ad request is in flight.
 */
@CapacitorPlugin(name = "Ads")
public class AdsPlugin extends Plugin {

    private static boolean sdkInitialized = false;
    private static boolean sdkStarting = false;

    private final Handler main = new Handler(Looper.getMainLooper());

    private FrameLayout bannerHolder;
    private AdView bannerView;

    private InterstitialAd interstitial;
    private boolean interstitialLoading = false;
    private boolean showWhenLoaded = false;

    private AppOpenAd appOpenAd;
    private boolean appOpenLoading = false;
    private long appOpenLoadedAt = 0L;
    private boolean showAppOpenWhenLoaded = false;

    private boolean showingFullScreen = false;
    private long lastFullScreenAt = 0L;
    private long lastInterstitialAt = 0L;
    private long startedAt = System.currentTimeMillis();
    private long backgroundedAt = 0L;
    private boolean criticalFlow = false;
    private boolean coldStartHandled = false;

    private static final java.util.List<String> adLog =
            java.util.Collections.synchronizedList(new java.util.ArrayList<String>());

    private static void log(String message) {
        String stamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date());
        adLog.add(stamp + "  " + message);
        if (adLog.size() > 80) adLog.remove(0);
        android.util.Log.i("Ads", message);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("sdkInitialized", sdkInitialized);
        result.put("testAds", AdsConfig.USE_TEST_ADS);
        result.put("interstitialReady", interstitial != null);
        result.put("appOpenReady", appOpenAd != null);
        result.put("criticalFlow", criticalFlow);
        StringBuilder sb = new StringBuilder();
        synchronized (adLog) {
            for (String line : adLog) sb.append(line).append("\n");
        }
        result.put("log", sb.toString());
        call.resolve(result);
    }

    // ---------------------------------------------------------------- lifecycle

    @PluginMethod
    public void initialize(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(new JSObject().put("ready", false));
            return;
        }
        startedAt = System.currentTimeMillis();
        main.post(() -> {
            log("initialize() called");
            try {
                requestConsentThenInit(activity);
            } catch (Throwable ignored) {
                startSdk();
            }
            // Safety net: never let a stuck consent flow block ad loading.
            main.postDelayed(this::startSdk, 2500);
            JSObject result = new JSObject();
            result.put("ready", true);
            result.put("testAds", AdsConfig.USE_TEST_ADS);
            call.resolve(result);
        });
    }

    /** Ask the UMP SDK for consent where required (EEA/UK), then start the ads SDK. */
    private void requestConsentThenInit(Activity activity) {
        ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
                .setTagForUnderAgeOfConsent(false)
                .build();
        info.requestConsentInfoUpdate(
                activity,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        activity, formError -> startSdk()),
                formError -> startSdk());
    }

    private void startSdk() {
        if (sdkInitialized) {
            log("SDK already initialized");
            preloadInterstitial();
            preloadAppOpen();
            return;
        }
        try {
            if (sdkStarting) return;
            sdkStarting = true;
            log("MobileAds.initialize()");
            // Release builds must never carry a test-device configuration: reset it
            // explicitly so a stale value can never label live ads as "Test Ad".
            if (!BuildConfig.DEBUG) {
                MobileAds.setRequestConfiguration(
                        new com.google.android.gms.ads.RequestConfiguration.Builder()
                                .setTestDeviceIds(new java.util.ArrayList<String>())
                                .build());
                log("release ad configuration: production units, no test devices");
            } else {
                log("debug build: Google demo ad units in use");
            }
            MobileAds.initialize(getContext(), status -> {
                sdkInitialized = true;
                log("SDK ready");
                preloadInterstitial();
                preloadAppOpen();
            });
        } catch (Throwable ignored) {
            /* ads unavailable on this device — app keeps working */
        }
    }

    @Override
    protected void handleOnPause() {
        backgroundedAt = System.currentTimeMillis();
        if (bannerView != null) bannerView.pause();
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (bannerView != null) bannerView.resume();
        long away = backgroundedAt == 0L ? 0L : System.currentTimeMillis() - backgroundedAt;
        backgroundedAt = 0L;
        if (away >= AdsConfig.APP_OPEN_MIN_BACKGROUND_MS) {
            main.postDelayed(this::maybeShowAppOpenInternal, 300);
        } else {
            preloadAppOpen();
        }
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            if (bannerView != null) {
                bannerView.destroy();
                bannerView = null;
            }
        });
        super.handleOnDestroy();
    }

    // ------------------------------------------------------------------- banner

    @PluginMethod
    public void showBanner(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(new JSObject().put("height", 0));
            return;
        }
        main.post(() -> {
            try {
                if (bannerView == null) {
                    AdSize size = adaptiveSize(activity);
                    bannerView = new AdView(activity);
                    bannerView.setAdUnitId(AdsConfig.bannerUnitId());
                    bannerView.setAdSize(size);
                    bannerView.setBackgroundColor(Color.TRANSPARENT);
                    bannerView.setAdListener(new AdListener() {
                        @Override
                        public void onAdFailedToLoad(LoadAdError error) {
                            notifyBannerHeight(0);
                        }

                        @Override
                        public void onAdLoaded() {
                            notifyBannerHeight(currentBannerHeightPx(activity));
                        }
                    });

                    bannerHolder = new FrameLayout(activity);
                    FrameLayout.LayoutParams holderParams = new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            Gravity.BOTTOM);
                    bannerHolder.setLayoutParams(holderParams);
                    bannerHolder.addView(bannerView, new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL));

                    // Keep the banner clear of the navigation bar / gesture area.
                    ViewCompat.setOnApplyWindowInsetsListener(bannerHolder, (view, insets) -> {
                        Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                        view.setPadding(0, 0, 0, bars.bottom);
                        notifyBannerHeight(currentBannerHeightPx(activity));
                        return insets;
                    });

                    ViewGroup content = activity.findViewById(android.R.id.content);
                    if (content != null) content.addView(bannerHolder);
                    log(AdsConfig.describeRequest("banner", AdsConfig.bannerUnitId()));
                    bannerView.loadAd(new AdRequest.Builder().build());
                }
                bannerHolder.setVisibility(View.VISIBLE);
                JSObject result = new JSObject();
                result.put("height", currentBannerHeightPx(activity));
                call.resolve(result);
            } catch (Throwable error) {
                call.resolve(new JSObject().put("height", 0));
            }
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        main.post(() -> {
            if (bannerHolder != null) bannerHolder.setVisibility(View.GONE);
            notifyBannerHeight(0);
            call.resolve();
        });
    }

    private AdSize adaptiveSize(Activity activity) {
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        int widthDp = Math.max(320, (int) (metrics.widthPixels / metrics.density));
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp);
    }

    private int currentBannerHeightPx(Activity activity) {
        if (bannerView == null || bannerHolder == null
                || bannerHolder.getVisibility() != View.VISIBLE) {
            return 0;
        }
        AdSize size = bannerView.getAdSize();
        int adHeight = size == null
                ? 0
                : size.getHeightInPixels(activity);
        return adHeight + bannerHolder.getPaddingBottom();
    }

    private void notifyBannerHeight(int px) {
        JSObject payload = new JSObject();
        payload.put("height", px);
        notifyListeners("bannerHeight", payload);
    }

    // ------------------------------------------------------------- interstitial

    @PluginMethod
    public void preload(PluginCall call) {
        main.post(() -> {
            preloadInterstitial();
            preloadAppOpen();
            call.resolve();
        });
    }

    @PluginMethod
    public void setCriticalFlow(PluginCall call) {
        criticalFlow = Boolean.TRUE.equals(call.getBoolean("active", false));
        call.resolve();
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        Activity activity = getActivity();
        long now = System.currentTimeMillis();
        // "force" is used for key transitions (e.g. right after a TV connects):
        // the cool-down is skipped, but a critical flow is still never interrupted.
        boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        boolean eligible = activity != null
                && interstitial != null
                && !showingFullScreen
                && !criticalFlow
                && (force || (now - startedAt >= AdsConfig.INTERSTITIAL_STARTUP_GRACE_MS
                        && now - lastInterstitialAt >= AdsConfig.INTERSTITIAL_COOLDOWN_MS
                        && now - lastFullScreenAt >= AdsConfig.FULLSCREEN_GAP_MS));

        if (activity != null && interstitial == null && !showingFullScreen && !criticalFlow) {
            // Nothing cached yet — load now and show as soon as it arrives.
            log("interstitial requested but not cached; loading on demand");
            showWhenLoaded = true;
            preloadInterstitial();
            call.resolve(new JSObject().put("shown", false));
            return;
        }

        if (!eligible) {
            log("interstitial skipped (cooldown/critical flow)");
            preloadInterstitial();
            call.resolve(new JSObject().put("shown", false));
            return;
        }


        main.post(() -> {
            InterstitialAd ad = interstitial;
            if (ad == null) {
                call.resolve(new JSObject().put("shown", false));
                return;
            }
            interstitial = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    showingFullScreen = true;
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    showingFullScreen = false;
                    lastFullScreenAt = System.currentTimeMillis();
                    lastInterstitialAt = lastFullScreenAt;
                    preloadInterstitial();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    showingFullScreen = false;
                    preloadInterstitial();
                }
            });
            try {
                ad.show(activity);
                call.resolve(new JSObject().put("shown", true));
            } catch (Throwable error) {
                showingFullScreen = false;
                call.resolve(new JSObject().put("shown", false));
            }
        });
    }

    /** Shows the cached interstitial immediately, bypassing the request plumbing. */
    private void showInterstitialNow() {
        Activity activity = getActivity();
        InterstitialAd ad = interstitial;
        if (activity == null || ad == null || showingFullScreen || criticalFlow) return;
        interstitial = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                showingFullScreen = true;
                log("interstitial shown");
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                showingFullScreen = false;
                lastFullScreenAt = System.currentTimeMillis();
                lastInterstitialAt = lastFullScreenAt;
                preloadInterstitial();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                showingFullScreen = false;
                log("interstitial show failed: " + error.getMessage());
                preloadInterstitial();
            }
        });
        try {
            ad.show(activity);
        } catch (Throwable error) {
            showingFullScreen = false;
        }
    }

    private void preloadInterstitial() {
        if (!sdkInitialized || interstitial != null || interstitialLoading) return;
        Activity activity = getActivity();
        if (activity == null) return;
        interstitialLoading = true;
        main.post(() -> {
            try {
                log(AdsConfig.describeRequest("interstitial", AdsConfig.interstitialUnitId()));
                InterstitialAd.load(
                        activity,
                        AdsConfig.interstitialUnitId(),
                        new AdRequest.Builder().build(),
                        new InterstitialAdLoadCallback() {
                            @Override
                            public void onAdLoaded(InterstitialAd ad) {
                                interstitialLoading = false;
                                interstitial = ad;
                                log("interstitial loaded");
                                if (showWhenLoaded) {
                                    showWhenLoaded = false;
                                    showInterstitialNow();
                                }
                            }

                            @Override
                            public void onAdFailedToLoad(LoadAdError error) {
                                interstitialLoading = false;
                                interstitial = null;
                                showWhenLoaded = false;
                                log("interstitial FAILED: " + error.getCode() + " " + error.getMessage());
                            }
                        });
            } catch (Throwable error) {
                interstitialLoading = false;
            }
        });
    }

    // ----------------------------------------------------------------- app open

    @PluginMethod
    public void maybeShowAppOpen(PluginCall call) {
        main.post(() -> {
            maybeShowAppOpenInternal();
            call.resolve();
        });
    }

    private void maybeShowAppOpenInternal() {
        Activity activity = getActivity();
        long now = System.currentTimeMillis();
        boolean fresh = appOpenAd != null && now - appOpenLoadedAt < AdsConfig.APP_OPEN_EXPIRY_MS;
        if (activity == null || !fresh || showingFullScreen || criticalFlow
                || now - lastFullScreenAt < AdsConfig.FULLSCREEN_GAP_MS) {
            if (!fresh) {
                appOpenAd = null;
                showAppOpenWhenLoaded = true;
                preloadAppOpen();
            }
            return;
        }
        AppOpenAd ad = appOpenAd;
        appOpenAd = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                showingFullScreen = true;
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                showingFullScreen = false;
                lastFullScreenAt = System.currentTimeMillis();
                preloadAppOpen();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                showingFullScreen = false;
                preloadAppOpen();
            }
        });
        try {
            ad.show(activity);
        } catch (Throwable error) {
            showingFullScreen = false;
        }
    }

    private void preloadAppOpen() {
        if (!sdkInitialized || appOpenAd != null || appOpenLoading) return;
        Activity activity = getActivity();
        if (activity == null) return;
        appOpenLoading = true;
        main.post(() -> {
            try {
                log(AdsConfig.describeRequest("app open", AdsConfig.appOpenUnitId()));
                AppOpenAd.load(
                        activity,
                        AdsConfig.appOpenUnitId(),
                        new AdRequest.Builder().build(),
                        new AppOpenAd.AppOpenAdLoadCallback() {
                            @Override
                            public void onAdLoaded(AppOpenAd ad) {
                                appOpenLoading = false;
                                appOpenAd = ad;
                                appOpenLoadedAt = System.currentTimeMillis();
                                log("app open loaded");
                                if (!coldStartHandled || showAppOpenWhenLoaded) {
                                    coldStartHandled = true;
                                    showAppOpenWhenLoaded = false;
                                    maybeShowAppOpenInternal();
                                }
                            }

                            @Override
                            public void onAdFailedToLoad(LoadAdError error) {
                                appOpenLoading = false;
                                appOpenAd = null;
                                showAppOpenWhenLoaded = false;
                                coldStartHandled = true;
                                log("app open FAILED: " + error.getCode() + " " + error.getMessage());
                            }
                        });
            } catch (Throwable error) {
                appOpenLoading = false;
            }
        });
    }
}
