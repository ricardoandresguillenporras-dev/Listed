package com.listed.app;

import android.os.Build;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onBackPressed() {
        // Do NOT call super.onBackPressed()
        // This prevents Android from minimizing/closing the app.
        // Capacitor's @capacitor/app backButton event handles everything.
        if (this.bridge != null) {
            this.bridge.triggerWindowJSEvent("backbutton");
        }
    }
}
