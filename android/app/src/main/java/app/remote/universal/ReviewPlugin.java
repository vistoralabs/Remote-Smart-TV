package app.remote.universal;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Google Play In-App Review bridge — official API only.
 *
 * <p>No custom rating UI lives here. {@code requestReview} asks Play for the sheet and
 * reports back exactly what happened (including why nothing appeared) so the web layer
 * can log it. {@code openStore} is used only for an explicit "Rate this app" tap.
 */
@CapacitorPlugin(name = "Review")
public class ReviewPlugin extends Plugin {

    private static final String TAG = "REVIEW";
    private static final String PACKAGE = "app.remote.universal";
    private static final String STORE_URL =
            "https://play.google.com/store/apps/details?id=" + PACKAGE;

    private String lastReason = "";

    private void note(String reason) {
        lastReason = reason;
        Log.i(TAG, reason);
    }

    private boolean playAvailable() {
        try {
            int code = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
            return code == ConnectionResult.SUCCESS;
        } catch (Throwable error) {
            return false;
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("debug", BuildConfig.DEBUG);
        result.put("playAvailable", playAvailable());
        result.put("lastReason", lastReason);
        call.resolve(result);
    }

    @PluginMethod
    public void requestReview(PluginCall call) {
        if (getActivity() == null) {
            note("no activity — cannot launch review flow");
            call.resolve(new JSObject().put("launched", false).put("reason", lastReason));
            return;
        }
        if (!playAvailable()) {
            note("Google Play services unavailable on this device");
            call.resolve(new JSObject().put("launched", false).put("reason", lastReason));
            return;
        }
        try {
            note("requestReviewFlow() start");
            ReviewManager manager = ReviewManagerFactory.create(getContext());
            manager.requestReviewFlow().addOnCompleteListener(request -> {
                if (!request.isSuccessful()) {
                    Exception error = request.getException();
                    note("requestReviewFlow failed: "
                            + (error == null ? "unknown" : error.getMessage()));
                    call.resolve(new JSObject().put("launched", false).put("reason", lastReason));
                    return;
                }
                note("requestReviewFlow ok — launching sheet");
                ReviewInfo info = request.getResult();
                manager.launchReviewFlow(getActivity(), info)
                        .addOnCompleteListener(flow -> {
                            boolean launched = flow.isSuccessful();
                            note(launched
                                    ? "launchReviewFlow completed (Play may suppress the sheet by quota)"
                                    : "launchReviewFlow failed");
                            call.resolve(new JSObject()
                                    .put("launched", launched)
                                    .put("reason", lastReason));
                        });
            });
        } catch (Throwable error) {
            note("review flow threw: " + error.getMessage());
            call.resolve(new JSObject().put("launched", false).put("reason", lastReason));
        }
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        boolean opened = openStoreInternal();
        call.resolve(new JSObject().put("openedStore", opened));
    }

    /** Play Store app first, browser as the fallback. */
    private boolean openStoreInternal() {
        if (getActivity() == null) return false;
        try {
            Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + PACKAGE));
            market.setPackage("com.android.vending");
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(market);
            note("opened Play Store app");
            return true;
        } catch (Throwable ignored) {
            try {
                Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(STORE_URL));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(web);
                note("opened Play listing in browser");
                return true;
            } catch (Throwable ignored2) {
                note("could not open Play listing");
                return false;
            }
        }
    }
}
