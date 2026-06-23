package com.listed.app;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Fire Capacitor's backButton event to JS
                if (bridge != null) {
                    bridge.triggerJSEvent("backButton", "window", "{}");
                }
            }
        });
    }
}
