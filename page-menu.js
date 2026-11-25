'use strict';
/* INCYDENTY · Tablica informacyjna · jedno menu „Nowa podstrona” zamiast trzech przycisków.
   Nie zmienia edytorów: menu wywołuje istniejące przyciski (#docAdd, #isaNew, #pdfSlidesAdd),
   które zostają w DOM, ale są ukryte. Bez tego pliku Tablica działa jak dotychczas. */
(()=>{
  const $=id=>document.getElementById(id);
  const ITEMS=[
    {id:'docAdd',icon:'▦',title:'Scena TV',text:'Swobodny układ: zdjęcia, tekst, tabele, alerty'},
    {id:'isaNew',icon:'▧',title:'Ogłoszenie z szablonu',text:'Zdjęcia i tekst w gotowych układach'},
    {id:'pdfSlidesAdd',icon:'▤',title:'Dokument PDF',text:'Plan ewakuacji lub instrukcja'}
  ];
  let installed=false;

  function install(force){
    if(installed||!$('isaNew'))return installed;
    if(!force&&!ITEMS.every(i=>$(i.id)))return false;
    installed=true;

    const style=document.createElement('style');
    style.textContent=`
      #infoSlidesArea #isaNew,#infoSlidesArea #pdfSlidesAdd,#infoSlidesArea #docAdd{display:none!important}
      #infoSlidesArea .pm-wrap{position:relative;display:inline-block}
      #infoSlidesArea #pageMenuBtn{white-space:nowrap}
      #infoSlidesArea .pm-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:60;width:min(330px,calc(100vw - 16px));padding:6px;border:1px solid #dbe6f0;border-radius:14px;background:#fff;box-shadow:0 14px 34px rgba(20,44,48,.16);display:flex;flex-direction:column;gap:2px}
      #infoSlidesArea .pm-menu[hidden]{display:none}
      #infoSlidesArea .pm-item{display:grid;grid-template-columns:26px 1fr;column-gap:10px;row-gap:1px;align-items:center;width:100%;padding:9px 10px;border:0;border-radius:10px;background:transparent;color:#1d2b3a;font:inherit;text-align:left;cursor:pointer}
      #infoSlidesArea .pm-item:hover,#infoSlidesArea .pm-item:focus-visible{background:#eef6ff;outline:none}
      #infoSlidesArea .pm-ico{grid-row:span 2;font-size:18px;line-height:1;color:#0a84ff;text-align:center}
      #infoSlidesArea .pm-item strong{font-size:13px}
      #infoSlidesArea .pm-item small{font-size:11.5px;line-height:1.3;color:#6b7b8d}
    `;
    document.head.append(style);

    const host=$('isaNew').parentElement;
    const wrap=document.createElement('div');wrap.className='pm-wrap';
    const btn=document.createElement('button');
    btn.type='button';btn.id='pageMenuBtn';btn.className='primary';btn.textContent='＋ Nowa podstrona ▾';
    btn.setAttribute('aria-haspopup','menu');btn.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');
    menu.id='pageMenu';menu.className='pm-menu';menu.hidden=true;menu.setAttribute('role','menu');
    wrap.append(btn,menu);
    host.insertBefore(wrap,$('isaNew'));

    const entries=()=>[...menu.querySelectorAll('.pm-item')];
    function build(){ // przyciski mogą pojawić się później, więc pozycje powstają przy otwarciu
      menu.replaceChildren();
      for(const item of ITEMS){
        if(!$(item.id))continue;
        const b=document.createElement('button');
        b.type='button';b.className='pm-item';b.setAttribute('role','menuitem');
        const ico=document.createElement('span');ico.className='pm-ico';ico.textContent=item.icon;ico.setAttribute('aria-hidden','true');
        const t=document.createElement('strong');t.textContent=item.title;
        const s=document.createElement('small');s.textContent=item.text;
        b.append(ico,t,s);
        b.onclick=()=>{close();$(item.id)?.click();};
        menu.append(b);
      }
    }
    function open(focusFirst){
      build();menu.hidden=false;btn.setAttribute('aria-expanded','true');
      keepInView();
      if(focusFirst)entries()[0]?.focus();
    }
    function keepInView(){ // na wąskich ekranach przycisk jest wyśrodkowany, więc menu przesuwamy do widocznego obszaru
      menu.style.transform='';
      const r=menu.getBoundingClientRect(),vw=document.documentElement.clientWidth,m=8;
      const dx=r.left<m?m-r.left:r.right>vw-m?vw-m-r.right:0;
      if(dx)menu.style.transform='translateX('+Math.round(dx)+'px)';
    }
    function close(){menu.hidden=true;btn.setAttribute('aria-expanded','false');}

    btn.addEventListener('click',()=>{menu.hidden?open(false):close();});
    btn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open(true);}});
    menu.addEventListener('keydown',e=>{
      const list=entries(),i=list.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){e.preventDefault();list[(i+1)%list.length]?.focus();}
      else if(e.key==='ArrowUp'){e.preventDefault();list[(i-1+list.length)%list.length]?.focus();}
    });
    // Esc zamyka tylko to menu i nie przechodzi dalej (np. do trybu TV)
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();close();btn.focus();}
    },true);
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
    window.addEventListener('resize',close);
    wrap.addEventListener('focusout',e=>{if(!menu.hidden&&!wrap.contains(e.relatedTarget))close();});
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(tries>100)||tries>400)clearInterval(timer); // po ~5 s działa także z częścią przycisków
  },50);
})();
