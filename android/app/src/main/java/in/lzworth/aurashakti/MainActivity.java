package in.lzworth.aurashakti;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Last value pushed, so the webview is not asked to re-evaluate for nothing. */
    private int lastImeCss = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before the bridge starts, or the web layer cannot see it.
        registerPlugin(InstallPermissionPlugin.class);
        super.onCreate(savedInstanceState);
        publishKeyboardHeight();
    }

    /**
     * Tells the web layer how tall the keyboard is, from here rather than
     * through a plugin.
     *
     * The web side had two ways to find this out and both failed on a real
     * device. Measuring the viewport cannot work, because with adjustNothing
     * the window never changes size — innerHeight and visualViewport report
     * the same number whether the keyboard is up or not. And the keyboard
     * plugin's events, which do carry the height, were reached through a
     * dynamic import that had already been seen hanging on that same phone,
     * leaving no listener registered and nothing in any log to say so.
     *
     * WindowInsets is the platform's own answer to the question and does not
     * depend on either. It is delivered by the framework on every inset pass,
     * on every OEM, and it is exact.
     *
     * The value is converted to CSS pixels here — the web layer works in
     * those, and dividing by density in JavaScript would mean trusting a
     * second reading of the same number.
     */
    private void publishKeyboardHeight() {
        final View root = getWindow().getDecorView();

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());

            // Only the part of the keyboard that is not already accounted for
            // by the navigation bar, which the layout has allowed for anyway.
            int overlap = Math.max(0, ime.bottom - bars.bottom);
            float density = getResources().getDisplayMetrics().density;
            int css = Math.round(overlap / density);

            if (css != lastImeCss) {
                lastImeCss = css;
                pushToWebView(css);
            }
            return insets;
        });
    }

    private void pushToWebView(int cssPixels) {
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final String js =
            "(function(){"
          + "  window.__auraNativeKb = true;"
          + "  window.__auraKbHeight = " + cssPixels + ";"
          + "  window.__auraKbNote = 'native insets: " + cssPixels + "px';"
          + "  document.documentElement.style.setProperty('--kb-inset','" + cssPixels + "px');"
          + "  window.dispatchEvent(new CustomEvent('aura:keyboard',{detail:" + cssPixels + "}));"
          + "})()";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
