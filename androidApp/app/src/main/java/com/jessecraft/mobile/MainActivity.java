package com.jessecraft.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String PREFERENCES_NAME = "server_settings";
    private static final String SERVER_URL_KEY = "server_url";
    private static final String DEFAULT_SERVER_URL = "http://natalie-khe9ca.cloudserver.nz";

    private SharedPreferences preferences;
    private WebView webView;
    private EditText serverUrlInput;
    private TextView errorMessage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE);

        String savedUrl = preferences.getString(SERVER_URL_KEY, null);
        if (savedUrl == null) {
            showSettings(DEFAULT_SERVER_URL);
        } else {
            showWebView(savedUrl);
        }
    }

    private void showSettings(String initialUrl) {
        setImmersiveMode(false);
        setContentView(R.layout.activity_settings);

        serverUrlInput = findViewById(R.id.server_url);
        errorMessage = findViewById(R.id.error_message);
        Button saveButton = findViewById(R.id.save_server);
        serverUrlInput.setText(initialUrl);
        saveButton.setOnClickListener(view -> saveServerUrl());
    }

    private void saveServerUrl() {
        String url = normalizeServerUrl(serverUrlInput.getText().toString());
        if (url == null) {
            errorMessage.setText(R.string.invalid_server_url);
            errorMessage.setVisibility(View.VISIBLE);
            return;
        }

        preferences.edit().putString(SERVER_URL_KEY, url).apply();
        InputMethodManager inputMethodManager =
                (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (inputMethodManager != null) {
            inputMethodManager.hideSoftInputFromWindow(serverUrlInput.getWindowToken(), 0);
        }
        showWebView(url);
    }

    private String normalizeServerUrl(String enteredUrl) {
        String url = enteredUrl.trim();
        if (url.isEmpty()) {
            return null;
        }
        if (!url.matches("(?i)^https?://.*")) {
            url = "https://" + url;
        }

        Uri parsedUrl = Uri.parse(url);
        String scheme = parsedUrl.getScheme();
        if (parsedUrl.getHost() == null
                || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
            return null;
        }
        return parsedUrl.toString();
    }

    private void showWebView(String url) {
        setImmersiveMode(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        setContentView(webView);
        webView.loadUrl(url);
    }

    private void setImmersiveMode(boolean immersive) {
        Window window = getWindow();
        if (immersive) {
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                String savedUrl = preferences.getString(SERVER_URL_KEY, DEFAULT_SERVER_URL);
                webView.stopLoading();
                webView.destroy();
                webView = null;
                showSettings(savedUrl);
            }
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
