const { evalInPage, close } = await import('./.cdp.mjs');
console.log(await evalInPage(`(function(){var e=document.querySelector('textarea');var b=e.getBoundingClientRect();
 var r=document.getElementById('root').getBoundingClientRect();
 return JSON.stringify({active:document.activeElement.tagName, inner:innerHeight,
  kbInset:getComputedStyle(document.documentElement).getPropertyValue('--kb-inset').trim(),
  note:window.__auraKbNote||'-', composer:Math.round(b.top)+'-'+Math.round(b.bottom), root:Math.round(r.height)});})()`));
close();
