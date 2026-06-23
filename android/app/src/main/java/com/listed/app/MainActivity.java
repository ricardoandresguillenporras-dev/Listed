package com.listed.app;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Capacitor 8 handles the backButton event internally.
                // We intercept here and do nothing — JS handles all navigation.
            }
        });
    }
}
