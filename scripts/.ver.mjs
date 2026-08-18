const { evalInPage, close } = await import('./.cdp.mjs');
console.log(await evalInPage(`(async () => {
  const C = window.Capacitor.Plugins;
  const cur = await C.CapacitorUpdater.current();
  const info = await C.App.getInfo();
  let apk = null;
  try { apk = await (await fetch('https://aurashakti.vercel.app/updates/apk.json',{cache:'no-store'})).json(); } catch(e) { apk = String(e); }
  return JSON.stringify({ apkInstalled: info.version, webBundle: cur.bundle.version, apkOffered: apk && apk.version });
})()`));
close();
