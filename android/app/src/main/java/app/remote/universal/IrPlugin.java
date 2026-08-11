package app.remote.universal;

import android.content.Context;
import android.hardware.ConsumerIrManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.List;

/** Bridges the phone's built-in IR emitter to the web layer. */
@CapacitorPlugin(name = "Ir")
public class IrPlugin extends Plugin {

    private static final String TAG = "IR";

    private static final int MIN_FREQUENCY = 20000;
    private static final int MAX_FREQUENCY = 60000;
    private static final int MAX_PATTERN_ITEMS = 4096;
    private static final int MAX_PULSE_MICROS = 100000;

    private ConsumerIrManager irManager() {
        Context context = getContext();
        if (context == null) return null;
        return (ConsumerIrManager) context.getSystemService(Context.CONSUMER_IR_SERVICE);
    }

    /**
     * Some emitters only accept the carriers they advertise. When the requested
     * frequency falls outside every supported range, snap it to the closest
     * supported edge instead of failing the whole transmit.
     */
    private int nearestSupported(ConsumerIrManager ir, int carrier) {
        ConsumerIrManager.CarrierFrequencyRange[] ranges = ir.getCarrierFrequencies();
        if (ranges == null || ranges.length == 0) return carrier;
        int best = carrier;
        int bestDistance = Integer.MAX_VALUE;
        for (ConsumerIrManager.CarrierFrequencyRange range : ranges) {
            if (carrier >= range.getMinFrequency() && carrier <= range.getMaxFrequency()) {
                return carrier;
            }
            int edge = carrier < range.getMinFrequency() ? range.getMinFrequency() : range.getMaxFrequency();
            int distance = Math.abs(edge - carrier);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = edge;
            }
        }
        return best;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        ConsumerIrManager ir = irManager();
        boolean available = ir != null && ir.hasIrEmitter();
        Log.i(TAG, "emitter available=" + available + " device=" + Build.MANUFACTURER + " " + Build.MODEL);
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        call.resolve(result);
    }

    @PluginMethod
    public void getCarrierFrequencies(PluginCall call) {
        ConsumerIrManager ir = irManager();
        JSArray ranges = new JSArray();
        if (ir != null && ir.hasIrEmitter()) {
            for (ConsumerIrManager.CarrierFrequencyRange range : ir.getCarrierFrequencies()) {
                JSObject item = new JSObject();
                item.put("min", range.getMinFrequency());
                item.put("max", range.getMaxFrequency());
                ranges.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("ranges", ranges);
        call.resolve(result);
    }

    /** transmit({ frequency: 38000, pattern: [9000, 4500, ...] }) — pattern is in microseconds. */
    @PluginMethod
    public void transmit(PluginCall call) {
        ConsumerIrManager ir = irManager();
        if (ir == null || !ir.hasIrEmitter()) {
            Log.w(TAG, "transmit refused: no IR emitter on this device");
            call.reject("This phone has no IR emitter");
            return;
        }

        Integer frequency = call.getInt("frequency", 38000);
        JSArray patternArray = call.getArray("pattern");
        if (patternArray == null || patternArray.length() == 0) {
            call.reject("Missing IR pattern");
            return;
        }
        int carrier = frequency == null ? 38000 : frequency;
        if (carrier < MIN_FREQUENCY || carrier > MAX_FREQUENCY) {
            call.reject("Unsupported IR carrier frequency: " + carrier + " Hz");
            return;
        }
        int requested = carrier;
        carrier = nearestSupported(ir, carrier);
        if (carrier != requested) {
            Log.i(TAG, "carrier snapped " + requested + " Hz -> " + carrier + " Hz");
        }
        if (patternArray.length() > MAX_PATTERN_ITEMS) {
            call.reject("IR pattern is too long");
            return;
        }

        try {
            List<Integer> values = patternArray.toList();
            int[] pattern = new int[values.size()];
            for (int i = 0; i < values.size(); i++) {
                Integer pulse = values.get(i);
                if (pulse == null || pulse <= 0 || pulse > MAX_PULSE_MICROS) {
                    call.reject("Invalid IR pulse at position " + i);
                    return;
                }
                pattern[i] = pulse;
            }
            Log.i(TAG, "transmit " + carrier + " Hz, " + pattern.length + " pulses");
            ir.transmit(carrier, pattern);
            call.resolve(new JSObject().put("sent", true).put("frequency", carrier));
        } catch (JSONException error) {
            call.reject("Bad IR pattern: " + error.getMessage());
        } catch (IllegalArgumentException error) {
            Log.w(TAG, "emitter rejected pattern: " + error.getMessage());
            call.reject("IR emitter rejected the pattern: " + error.getMessage());
        }
    }
}
