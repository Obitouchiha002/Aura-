const { evalInPage, close } = await import('./.cdp.mjs');
const M = `(() => { const vv=window.visualViewport,r=document.getElementById('root');
 return {inner:window.innerHeight, vv:vv?Math.round(vv.height):null,
  kb:getComputedStyle(document.documentElement).getPropertyValue('--kb-inset').trim()||'0px',
  root:r?Math.round(r.getBoundingClientRect().height):null}; })()`;
if (process.argv[2] === 'setup') {
  await evalInPage(`(() => { let el=document.getElementById('__kb'); if(!el){el=document.createElement('input');el.id='__kb';
    el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;width:220px;height:44px;font-size:16px';
    document.body.appendChild(el);} const r=el.getBoundingClientRect();
    return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,dpr:devicePixelRatio}); })()`);
  const g = JSON.parse(await evalInPage(`(() => { const r=document.getElementById('__kb').getBoundingClientRect();
    return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,dpr:devicePixelRatio}); })()`));
  console.log(JSON.stringify(g));
} else {
  console.log(await evalInPage(M).then(v => JSON.stringify(v)));
}
close();
