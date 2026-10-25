package com.iswandi.catatanikan;

import android.os.Bundle;
import android.graphics.Color;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure status bar is never obscured by the webview and has a dedicated solid dark background
        if (getWindow() != null) {
            getWindow().setStatusBarColor(Color.parseColor("#0a0e17"));
            getWindow().setNavigationBarColor(Color.parseColor("#0a0e17"));
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false); // White icons (battery, clock, wifi)
            }
        }
    }
}
