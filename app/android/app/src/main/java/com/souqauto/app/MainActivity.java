package com.souqauto.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Google bloque l'OAuth dans les WebViews en détectant "; wv" dans le User-Agent.
        // On le retire pour que la connexion Google fonctionne normalement.
        WebView webView = getBridge().getWebView();
        String ua = webView.getSettings().getUserAgentString();
        webView.getSettings().setUserAgentString(ua.replace("; wv", ""));
    }
}
