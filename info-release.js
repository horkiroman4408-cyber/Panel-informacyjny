'use strict';
/* INCYDENTY · informational copy and release history. The version number itself comes from version.json. */
// Add the new release at the TOP of this list before running tools/release.py (the script checks it).
const RELEASES=[
  {v:'1.1.66',date:'25.11.2026',title:'Jedno menu „Nowa podstrona”',text:'W Tablicy informacyjnej trzy przyciski tworzenia podstron (Dodaj PDF, Konstruktor, Nowa podstrona) zastąpiono jednym menu „Nowa podstrona”: Scena TV, Ogłoszenie z szablonu i Dokument PDF. Edytory i zapisane podstrony działają bez zmian.'},
  {v:'1.1.65',date:'25.11.2026',title:'Porządek w numerach wersji',text:'Numer wersji w oknie Informacje i w statusie PWA jest odczytywany z jednego pliku, version.json, więc zawsze zgadza się z zainstalowaną wersją. Uproszczono nazwę pamięci podręcznej offline oraz skrypt wydań. Bez zmian w danych, KPI, Excel i TV.'},
  {v:'1.1.64',date:'24.11.2026',title:'STOCK CONTROL, PDF i Tryb TV',text:'Dodano STOCK CONTROL z importem 3 eksportów Excel, filtrami marek i ekranami TV. W Tablica informacyjna dodano PDF jako zapisane podstrony, podgląd TV, dopasowanie i kadrowanie. Rozszerzono formatowanie tekstu. Uspójniono przejścia TV, nawigację i układ ekranów oraz poprawiono wyświetlanie źródeł i wskaźników.'}
];
(()=>{
  const $=id=>document.getElementById(id);
  const info=$('incInfo');if(!info)return;
  // Version labels follow version.json (also read in workers.js when the dialog opens).
  fetch('./version.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
    if(!j||!/^\d+\.\d+\.\d+$/.test(j.version))return;
    if($('incVersion'))$('incVersion').textContent='v'+j.version;
    if($('incAppVersion'))$('incAppVersion').textContent=j.version;
  }).catch(()=>{});
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
  if(history&&!history.querySelector('[data-inc-release]')){
    const first=history.querySelector('details');
    RELEASES.forEach((r,i)=>{
      const details=document.createElement('details');details.dataset.incRelease=r.v;details.open=i===0;
      const summary=document.createElement('summary');const strong=document.createElement('strong');strong.textContent='v'+r.v;
      summary.append(strong,document.createTextNode(' · '+r.date+' · '+r.title));
      const p=document.createElement('p');p.textContent=r.text;
      details.append(summary,p);
      if(first)history.insertBefore(details,first);else history.append(details);
    });
    for(const older of history.querySelectorAll('details:not([data-inc-release])'))older.open=false;
  }
})();
