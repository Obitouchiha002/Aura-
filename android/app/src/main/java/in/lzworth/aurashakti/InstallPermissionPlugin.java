package in.lzworth.aurashakti;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Whether this app is allowed to install another one, and a way to ask.
 *
 * REQUEST_INSTALL_PACKAGES in the manifest is only half of it. Since Android 8
 * the permission is granted per source by the user, so the first in-app update
 * hits "your phone currently isn't allowed to install unknown apps from this
 * source" — a dialog with no explanation of what to do next, arriving after a
 * 13 MB download.
 *
 * With this the app can check first and send the user straight to the right
 * settings page, once, and never mention it again.
 */
@CapacitorPlugin(name = "InstallPermission")
public class InstallPermissionPlugin extends Plugin {

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        // Below Oreo the permission is granted at install time and there is
        // nothing per-source to check.
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }
}
