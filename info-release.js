'use strict';
/* INCYDENTY 1.1.64 · update informational copy without replacing old controllers. */
(()=>{
  const $=id=>document.getElementById(id);
  const info=$('incInfo');if(!info)return;
  const version='1.1.64';
  if($('incVersion'))$('incVersion').textContent='v'+version;
  if($('incAppVersion'))$('incAppVersion').textContent=version;
  // Show all current sources in Dane. Original source metrics remain live.
  const data=$('incTabData');
  const sources=data?.querySelector('.inc-info-safe');
  if(data&&sources&&!$('incStockSourceInfo')){
    const item=(id,title,lines)=>{
      const row=document.createElement('div');row.className='inc-info-item';row.id=id;
      const inner=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;inner.append(strong);
      for(const line of lines){const small=document.createElement('small');small.textContent=line;inner.append(small)}
      row.append(inner);return row;
    };
    const stock=item('incStockSourceInfo','STOCK CONTROL',[
      'Trzy eksporty Excel z Power BI, arkusz Export: ALL SHELVES, NO OF UNITS oraz RS1 STOCK.',
      'Filtry marek, podsumowania, kolory procentów oraz osobne ekrany TV dla wszystkich marek, SINSAY i RTS. Import nie łączy się automatycznie z Power BI.'
    ]);
    const pdf=item('incPdfSourceInfo','Dokumenty PDF w Tablica informacyjna',[
      'PDF zapisany jako podstrona obok slajdów; obsługa planów ewakuacji, podglądu i osobnego ekranu TV.',
      'Pliki PDF są przechowywane lokalnie w IndexedDB przeglądarki.'
    ]);
    data.insertBefore(stock,data.querySelector('h3:nth-of-type(2)')||sources);
    data.insertBefore(pdf,data.querySelector('h3:nth-of-type(2)')||sources);
  }
  // Keep pre-existing calculation descriptions, active controls, and old histories.
  if(data){
    const notice=data.querySelector('.inc-info-safe p');
    if(notice)notice.textContent='Pliki Excel są przetwarzane lokalnie w przeglądarce. Wyniki procesów, karty pracowników, harmonogram i STOCK CONTROL są zapisywane lokalnie; podstrony informacyjne, zdjęcia oraz PDF w IndexedDB. Dane nie są wysyłane na własny serwer aplikacji i nie synchronizują się automatycznie między urządzeniami. Usunięcie danych witryny może skasować zapisane materiały. Podgląd PDF w TV może wymagać zewnętrznej biblioteki PDF.js.';
  }
  const app=$('incTabApp');
  if(app){
    const h=[...app.querySelectorAll('h3')].find(n=>n.textContent.trim()==='Tryb TV');
    if(h){
      const row=document.createElement('div');row.className='inc-info-item';row.innerHTML='<div><strong>STOCK CONTROL</strong><small>Trzy raporty Excel: stan półek, jednostki do rozłożenia i RS1. Filtry marek, wyniki zbiorcze i dedykowane ekrany TV.</small></div>';
      h.before(row);
      const existing=[...app.querySelectorAll('.inc-info-item')].find(n=>n.querySelector('strong')?.textContent.trim()==='Tablica informacyjna');
      const text=existing?.querySelector('small');if(text)text.textContent='Podstrony z fotografiami, tekstem i dokumentami PDF; edycja bezpośrednio w makiecie, formatowanie zaznaczonego tekstu i osobny wybór ekranów TV.';
      const tvParagraph=h.nextElementSibling;
      if(tvParagraph?.tagName==='P')tvParagraph.textContent='Wspólny pokaz wyników procesów, kart pracowników, harmonogramu, STOCK CONTROL (wszystkie marki lub osobno SINSAY / RTS), podstron i PDF. Można ustawić kolejność, czas wyświetlania, tryb stały lub automatyczny oraz przechodzić w przód i w tył. Ujednolicono animację pojawiania się ekranów.';
    }
  }
  const history=$('incTabHistory');
  if(history&&!$('incHistory1164')){
    const details=document.createElement('details');details.id='incHistory1164';details.open=true;
    const summary=document.createElement('summary');const strong=document.createElement('strong');strong.textContent='v1.1.64';summary.append(strong,document.createTextNode(' · 24.11.2026 · STOCK CONTROL, PDF i Tryb TV'));
    const p=document.createElement('p');p.textContent='Dodano STOCK CONTROL z importem 3 eksportów Excel, filtrami marek i ekranami TV. W Tablica informacyjna dodano PDF jako zapisane podstrony, podgląd TV, dopasowanie i kadrowanie. Rozszerzono formatowanie tekstu. Uspójniono przejścia TV, nawigację i układ ekranów oraz poprawiono wyświetlanie źródeł i wskaźników.';
    details.append(summary,p);
    const previous=history.querySelector('details');if(previous)history.insertBefore(details,previous);else history.append(details);
    for(const older of history.querySelectorAll('details:not(#incHistory1164)'))older.open=false;
  }
  const state=$('pwaState');
  if(state){
    const refresh=()=>{const next=state.textContent.replace(/1\.1\.63/g,version);if(next!==state.textContent)state.textContent=next;};
    refresh();new MutationObserver(refresh).observe(state,{childList:true,characterData:true,subtree:true});
  }
})();
