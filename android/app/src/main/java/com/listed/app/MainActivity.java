package com.listed.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onBackPressed() {
        // Block ALL back press handling from Android.
        // Capacitor 8 fires backButton to JS automatically before this.
        // Do NOT call super — that's what causes minimizing.
    }
}
