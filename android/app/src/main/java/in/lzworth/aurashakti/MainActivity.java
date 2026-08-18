package in.lzworth.aurashakti;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registered before the bridge starts, or the web layer cannot see it.
        registerPlugin(InstallPermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
