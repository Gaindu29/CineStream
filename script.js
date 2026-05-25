/* ═══════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════ */
const KEY  = '8265bd1679663a7ea12ac168da84d2e8';   // TMDB public demo key — hardcoded, no setup needed
const TBASE= 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';

// ─────────────────────────────────────────────────────────────
//  STREAMING SOURCES  (ordered best → fallback)
//  All sources use TMDB IDs — no extra keys needed.
//  The CineStream site itself is 100% ad-free; you can add
//  your own ad units to this page at any time.
// ─────────────────────────────────────────────────────────────
const MOVIE_SRCS = [
  // Confirmed live — all use TMDB IDs, no keys needed
  { id:'vsme',  name:'VidSrc',     fn: id => `https://vidsrc.me/embed/movie?tmdb=${id}` },
  { id:'vsfyi', name:'VidSrc FYI', fn: id => `https://vidsrc.fyi/embed/movie/${id}` },
  { id:'vasy',  name:'Videasy',    fn: id => `https://player.videasy.net/movie/${id}` },
  { id:'vsto',  name:'VidSrc .to', fn: id => `https://vidsrc.to/embed/movie/${id}` },
];
const TV_SRCS = [
  { id:'vsme',  name:'VidSrc',     fn:(id,s,e)=>`https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
  { id:'vsfyi', name:'VidSrc FYI', fn:(id,s,e)=>`https://vidsrc.fyi/embed/tv/${id}/${s}/${e}` },
  { id:'vasy',  name:'Videasy',    fn:(id,s,e)=>`https://player.videasy.net/tv/${id}/${s}/${e}` },
  { id:'vsto',  name:'VidSrc .to', fn:(id,s,e)=>`https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
];

const MG = {28:'Action',18:'Drama',35:'Comedy',27:'Horror',878:'Sci-Fi',10749:'Romance',53:'Thriller',16:'Animation',12:'Adventure',14:'Fantasy',80:'Crime',99:'Documentary'};
const TVG= {18:'Drama',80:'Crime',35:'Comedy',10765:'Sci-Fi',27:'Horror',16:'Animation',10759:'Action',9648:'Mystery',10762:'Kids'};

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let mode       = 'movie';   // 'movie' | 'tv'
let heroList   = [], heroIdx = 0, heroTmr = null;
let curId      = null, curType = 'movie';
let curSrc     = 0;
let curSeason  = 1, curEpisode = 1;
let tvSeasons  = [];

/* ═══════════════════════════════════════════════
   TMDB FETCH
═══════════════════════════════════════════════ */
async function api(path, params={}) {
  const p = new URLSearchParams({ api_key: KEY, language:'en-US', ...params });
  const r = await fetch(`${TBASE}${path}?${p}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ═══════════════════════════════════════════════
   NAV SCROLL
═══════════════════════════════════════════════ */
window.addEventListener('scroll', () =>
  document.getElementById('nav').classList.toggle('solid', scrollY > 30));

/* ═══════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════ */
function switchTab(m) {
  mode = m;
  document.getElementById('tabMovies').classList.toggle('on', m==='movie');
  document.getElementById('tabTV').classList.toggle('on',     m==='tv');
  document.getElementById('movieRows').style.display = m==='movie' ? '' : 'none';
  document.getElementById('tvRows').style.display    = m==='tv'    ? '' : 'none';
  document.getElementById('navUpcoming').style.display = m==='movie' ? '' : 'none';
  // update genre chips
  document.getElementById('chips').innerHTML = '';
  initChips();
  // load hero for current mode
  loadHero();
  // lazy-load TV rows once
  if (m==='tv') initTVRows();
  closeBrowse();
}

/* ═══════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════ */
async function loadHero() {
  clearInterval(heroTmr);
  document.getElementById('hdots').innerHTML = '';
  document.getElementById('htitle').textContent = 'Loading…';
  try {
    const path = mode==='movie' ? '/trending/movie/week' : '/trending/tv/week';
    const d = await api(path);
    heroList = d.results.slice(0,7);
    heroList.forEach((_,i)=>{
      const dot = document.createElement('div');
      dot.className = 'hdot'+(i===0?' on':'');
      dot.onclick = ()=>{ clearInterval(heroTmr); setHero(i); };
      document.getElementById('hdots').appendChild(dot);
    });
    setHero(0);
    heroTmr = setInterval(()=>setHero((heroIdx+1)%heroList.length), 7500);
  } catch(e){ document.getElementById('htitle').textContent = 'Could not load hero.'; }
}

function setHero(i) {
  heroIdx = i;
  const m = heroList[i];
  const title = m.title || m.name;
  const year  = (m.release_date||m.first_air_date||'').split('-')[0];
  const gids  = (m.genre_ids||[]).slice(0,3);
  const gnames= gids.map(g=>(mode==='movie'?MG:TVG)[g]).filter(Boolean).join(' · ');
  document.getElementById('heroBg').style.backgroundImage = `url(${IMG}/original${m.backdrop_path})`;
  document.getElementById('htitle').textContent     = title;
  document.getElementById('hoverview').textContent  = m.overview;
  document.getElementById('hbadge').textContent     = mode==='tv' ? '📺 Trending Series' : '🔥 Trending';
  document.getElementById('hmeta').innerHTML =
    `<span class="hrating">★ ${m.vote_average?.toFixed(1)||'N/A'}</span>
     <span>${year}</span>
     ${mode==='tv'?'<span class="type-badge type-tv">SERIES</span>':'<span class="type-badge type-movie">MOVIE</span>'}
     <span>${gnames}</span>`;
  document.getElementById('hplay').onclick = ()=> mode==='movie' ? openPlayer(m.id,'movie',title) : openModal(m.id,'tv');
  document.getElementById('hinfo').onclick = ()=> openModal(m.id, mode);
  document.querySelectorAll('.hdot').forEach((d,j)=>d.classList.toggle('on',j===i));
}

/* ═══════════════════════════════════════════════
   GENRE CHIPS
═══════════════════════════════════════════════ */
function initChips() {
  const el = document.getElementById('chips');
  const list = mode==='movie'
    ? [28,35,27,878,10749,53,12,80]
    : [18,80,35,10765,16,10762,9648];
  const gmap = mode==='movie' ? MG : TVG;
  list.forEach(id=>{
    const c = document.createElement('div');
    c.className = 'chip';
    c.textContent = gmap[id] || id;
    c.onclick=()=>{
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');
      browseGenre(id, gmap[id]||'Genre');
    };
    el.appendChild(c);
  });
}

/* ═══════════════════════════════════════════════
   CARD ROWS — MOVIES
═══════════════════════════════════════════════ */
async function loadRow(rowId, path, params={}, rank=false, type='movie') {
  const el = document.getElementById(rowId);
  if(!el) return;
  el.innerHTML = Array(9).fill('<div class="skel"></div>').join('');
  try {
    const d = await api(path, params);
    el.innerHTML='';
    (d.results||[]).slice(0,20).forEach((m,i)=> el.appendChild(makeCard(m,i,rank,type)));
  } catch { el.innerHTML='<p style="color:var(--muted);padding:14px">Could not load content.</p>'; }
}

function makeCard(m, idx=0, rank=false, type='movie') {
  const el = document.createElement('div');
  el.className = 'card';
  const poster = m.poster_path
    ? `${IMG}/w342${m.poster_path}`
    : `https://placehold.co/190x285/141924/8a96a8?text=${encodeURIComponent((m.title||m.name||'?').slice(0,12))}`;
  const title = m.title||m.name||'';
  const year  = (m.release_date||m.first_air_date||'').split('-')[0];
  el.innerHTML=`
    <img src="${poster}" alt="${title}" loading="lazy">
    ${rank?`<div class="crank">${idx+1}</div>`:''}
    ${type==='tv'?'<div class="ctv">SERIES</div>':''}
    <div class="cplay"><svg width="16" height="16" fill="var(--bg)" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    <div class="card-ov">
      <div class="card-ttl">${title}</div>
      <div class="card-inf">
        <span class="card-rat">★ ${m.vote_average?.toFixed(1)||'N/A'}</span>
        <span>${year}</span>
      </div>
    </div>`;
  el.onclick = () => openModal(m.id, type);
  return el;
}

/* ═══════════════════════════════════════════════
   INIT ROWS
═══════════════════════════════════════════════ */
let tvRowsLoaded = false;
function initMovieRows(){
  loadRow('rTrend',  '/trending/movie/week',{},true);
  loadRow('rPop',    '/movie/popular');
  loadRow('rTop',    '/movie/top_rated');
  loadRow('rAction', '/discover/movie',{with_genres:28,sort_by:'popularity.desc'});
  loadRow('rHorror', '/discover/movie',{with_genres:27,sort_by:'popularity.desc'});
  loadRow('rScifi',  '/discover/movie',{with_genres:878,sort_by:'popularity.desc'});
  loadRow('rUpcoming','/movie/upcoming');
}
function initTVRows(){
  if(tvRowsLoaded) return; tvRowsLoaded=true;
  loadRow('rTVTrend', '/trending/tv/week',  {}, true, 'tv');
  loadRow('rTVPop',   '/tv/popular',         {}, false,'tv');
  loadRow('rTVTop',   '/tv/top_rated',       {}, false,'tv');
  loadRow('rTVDrama', '/discover/tv', {with_genres:18,sort_by:'popularity.desc'}, false,'tv');
  loadRow('rTVCrime', '/discover/tv', {with_genres:80,sort_by:'popularity.desc'}, false,'tv');
  loadRow('rTVAnim',  '/discover/tv', {with_genres:16,sort_by:'popularity.desc'}, false,'tv');
}

/* ═══════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════ */
async function openModal(id, type='movie') {
  curId=id; curType=type; curSrc=0; curSeason=1; curEpisode=1; loadVotes(id); refreshWLBtn();
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow='hidden';
  // reset
  ['mtitle','moverview'].forEach(i=>document.getElementById(i).textContent='Loading…');
  document.getElementById('mmeta').innerHTML='';
  document.getElementById('mimg').src='';
  document.getElementById('msrcs').innerHTML='';
  document.getElementById('epPicker').style.display='none';
  try {
    const path = type==='movie' ? `/movie/${id}` : `/tv/${id}`;
    const [det, vids] = await Promise.all([api(path), api(`${path}/videos`)]);
    // banner
    document.getElementById('mimg').src = det.backdrop_path ? `${IMG}/w1280${det.backdrop_path}` : '';
    // title
    document.getElementById('mtitle').textContent = det.title||det.name||'';
    document.getElementById('moverview').textContent = det.overview||'';
    // meta
    const gs = (det.genres||[]).map(g=>`<span class="b">${g.name}</span>`).join('');
    const runtime = type==='movie'
      ? (det.runtime ? `${det.runtime} min` : '')
      : (det.number_of_seasons ? `${det.number_of_seasons} Season${det.number_of_seasons>1?'s':''}` : '');
    document.getElementById('mmeta').innerHTML=`
      <span class="b">★ ${det.vote_average?.toFixed(1)||'N/A'}</span>
      <span>${(det.release_date||det.first_air_date||'').split('-')[0]}</span>
      ${runtime?`<span>${runtime}</span>`:''}
      <span class="type-badge ${type==='tv'?'type-tv':'type-movie'}">${type==='tv'?'SERIES':'MOVIE'}</span>
      ${gs}`;
    // trailer
    const tr = (vids.results||[]).find(v=>v.type==='Trailer'&&v.site==='YouTube');
    document.getElementById('mtrailer').onclick = tr
      ? ()=>{ closeModal(); openFrameDirect(`https://www.youtube.com/embed/${tr.key}?autoplay=1`, (det.title||det.name)+' — Trailer'); }
      : ()=>toast('No trailer available.');
    // play button
    if(type==='movie'){
      document.getElementById('mplay').onclick = ()=>{ closeModal(); openPlayer(id,'movie',det.title); };
    } else {
      // For TV show load season selector
      tvSeasons = (det.seasons||[]).filter(s=>s.season_number>0);
      document.getElementById('mplay').onclick = ()=>{ closeModal(); openPlayer(id,'tv',det.name); };
      buildSeasonSelector(id, det.name);
    }
    // source buttons
    buildSrcBtns(id, type, det.title||det.name);
  } catch(e){ toast('Failed to load details. Try again.'); closeModal(); }
}

function buildSeasonSelector(showId, showName){
  const picker = document.getElementById('epPicker');
  picker.style.display='';
  const sel = document.getElementById('seasonSel');
  sel.innerHTML='';
  tvSeasons.forEach(s=>{
    const o = document.createElement('option');
    o.value=s.season_number;
    o.textContent=`Season ${s.season_number}${s.name&&s.name!==`Season ${s.season_number}`?' — '+s.name:''}`;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{ curSeason=parseInt(sel.value); loadEpisodes(); };
  curSeason=tvSeasons[0]?.season_number||1;
  sel.value=curSeason;
  loadEpisodes();
}

async function loadEpisodes(){
  const sel=document.getElementById('seasonSel');
  curSeason=parseInt(sel.value);
  curEpisode=1;
  const grid=document.getElementById('epGrid');
  grid.innerHTML='<span style="color:var(--muted);font-size:12px">Loading…</span>';
  try{
    const d=await api(`/tv/${curId}/season/${curSeason}`);
    const eps=d.episodes||[];
    document.getElementById('epCount').textContent=`${eps.length} episode${eps.length!==1?'s':''}`;
    grid.innerHTML='';
    eps.forEach(ep=>{
      const b=document.createElement('button');
      b.className='ep-btn'+(ep.episode_number===1?' on':'');
      b.textContent=`Ep ${ep.episode_number}`;
      b.title=ep.name||`Episode ${ep.episode_number}`;
      b.onclick=()=>{
        curEpisode=ep.episode_number;
        document.querySelectorAll('.ep-btn').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        // update play button behaviour
        const showName=document.getElementById('mtitle').textContent;
        document.getElementById('mplay').onclick=()=>{
          closeModal();
          openPlayer(curId,'tv',`${showName} — S${String(curSeason).padStart(2,'0')}E${String(curEpisode).padStart(2,'0')}`);
        };
      };
      grid.appendChild(b);
    });
    // also reset play for ep 1
    const showName=document.getElementById('mtitle').textContent;
    document.getElementById('mplay').onclick=()=>{
      closeModal();
      openPlayer(curId,'tv',`${showName} — S${String(curSeason).padStart(2,'0')}E${String(curEpisode).padStart(2,'0')}`);
    };
  } catch{ grid.innerHTML='<span style="color:var(--muted);font-size:12px">Could not load episodes.</span>'; }
}

function buildSrcBtns(id, type, title){
  const srcs = type==='movie' ? MOVIE_SRCS : TV_SRCS;
  const el=document.getElementById('msrcs');
  el.innerHTML='';
  srcs.forEach((s,i)=>{
    const b=document.createElement('button');
    b.className='sbtn'+(i===0?' on':'');
    b.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>${s.name}`;
    b.onclick=()=>{
      curSrc=i;
      document.querySelectorAll('.sbtn').forEach((x,j)=>x.classList.toggle('on',j===i));
      // update play button
      if(type==='movie'){
        document.getElementById('mplay').onclick=()=>{ closeModal(); openPlayer(id,'movie',title,i); };
      } else {
        const t=document.getElementById('mtitle').textContent;
        document.getElementById('mplay').onclick=()=>{ closeModal(); openPlayer(id,'tv',`${t} — S${String(curSeason).padStart(2,'0')}E${String(curEpisode).padStart(2,'0')}`,i); };
      }
    };
    el.appendChild(b);
  });
}

function closeModal(){ document.getElementById('modal').classList.remove('open'); document.body.style.overflow=''; }
function bgClose(e){ if(e.target===document.getElementById('modal')) closeModal(); }

/* ═══════════════════════════════════════════════
   PLAYER
═══════════════════════════════════════════════ */
function openPlayer(id, type, label, srcIdx=0){
  curId=id; curType=type; curSrc=srcIdx;
  const srcs = type==='movie' ? MOVIE_SRCS : TV_SRCS;
  const url   = type==='movie'
    ? srcs[srcIdx].fn(id)
    : srcs[srcIdx].fn(id, curSeason, curEpisode);
  document.getElementById('frame').src = url;
  document.getElementById('ptitle').textContent = label||'';
  document.getElementById('player').classList.add('open');
  document.body.style.overflow='hidden';
  showPlayerHint();
  buildPlayerSrcs(id, type, label, srcIdx);
  // Record to Continue Watching
  const poster   = document.getElementById('mimg')?.src || '';
  // Try to grab backdrop from mimg (full-width banner image)
  addToCW({
    id, type,
    title:   document.getElementById('mtitle')?.textContent || label || '',
    poster,
    backdrop: poster,   // mimg already shows the backdrop
    season:   type==='tv' ? curSeason  : null,
    episode:  type==='tv' ? curEpisode : null,
    srcIdx
  });
}

function buildPlayerSrcs(id, type, label, active){
  const srcs = type==='movie' ? MOVIE_SRCS : TV_SRCS;
  const el=document.getElementById('psrcs');
  el.innerHTML='';
  srcs.forEach((s,i)=>{
    const b=document.createElement('button');
    b.className='psb'+(i===active?' on':'');
    b.textContent=s.name;
    b.onclick=()=>{
      document.getElementById('frame').src = type==='movie'
        ? srcs[i].fn(id)
        : srcs[i].fn(id, curSeason, curEpisode);
      el.querySelectorAll('.psb').forEach((x,j)=>x.classList.toggle('on',j===i));
    };
    el.appendChild(b);
  });
}

function openFrameDirect(url, label){
  document.getElementById('frame').src=url;
  document.getElementById('ptitle').textContent=label||'';
  document.getElementById('psrcs').innerHTML='';
  document.getElementById('player').classList.add('open');
  document.body.style.overflow='hidden';
}
function closePlayer(){ document.getElementById('player').classList.remove('open'); document.getElementById('frame').src=''; document.body.style.overflow=''; }

/* ═══════════════════════════════════════════════
   SEARCH — suggestions on type, results on Enter / button
═══════════════════════════════════════════════ */
const qEl   = document.getElementById('q');
const suggEl= document.getElementById('suggestions');
let suggTmr, lastSuggQ = '';

function closeSuggestions(){ suggEl.classList.remove('open'); suggEl.innerHTML=''; }

// Show live suggestions while typing
qEl.addEventListener('input', function(){
  clearTimeout(suggTmr);
  const v = this.value.trim();
  if (!v){ closeSuggestions(); return; }
  suggTmr = setTimeout(() => fetchSuggestions(v), 260);
});

// Search on Enter key
qEl.addEventListener('keydown', function(e){
  if (e.key === 'Enter'){
    const v = this.value.trim();
    if (v){ closeSuggestions(); doSearch(v); }
  }
  if (e.key === 'Escape'){ closeSuggestions(); this.blur(); }
});

// Search on arrow button click
document.getElementById('srchBtn').addEventListener('click', function(){
  const v = qEl.value.trim();
  if (v){ closeSuggestions(); doSearch(v); }
});

// Close suggestions when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.srch-wrap')) closeSuggestions();
});

async function fetchSuggestions(q){
  if (q === lastSuggQ) return;
  lastSuggQ = q;
  try {
    const d = await api('/search/multi', { query: q, page: 1 });
    if (q !== lastSuggQ) return; // stale
    const items = (d.results||[])
      .filter(r => r.media_type==='movie' || r.media_type==='tv')
      .slice(0, 6);
    if (!items.length){ closeSuggestions(); return; }
    suggEl.innerHTML = '';
    items.forEach(m => {
      const title = m.title || m.name || '';
      const year  = (m.release_date||m.first_air_date||'').split('-')[0];
      const type  = m.media_type;
      const poster = m.poster_path
        ? `${IMG}/w92${m.poster_path}`
        : `https://placehold.co/34x50/141924/8a96a8?text=?`;
      const row = document.createElement('div');
      row.className = 'sugg-item';
      row.innerHTML = `
        <img class="sugg-poster" src="${poster}" alt="${title}" loading="lazy">
        <div class="sugg-info">
          <div class="sugg-title">${title}</div>
          <div class="sugg-meta">
            <span class="sugg-type ${type}">${type==='tv'?'Series':'Movie'}</span>
            ${year ? `<span>${year}</span>` : ''}
            ${m.vote_average ? `<span>★ ${m.vote_average.toFixed(1)}</span>` : ''}
          </div>
        </div>`;
      row.onclick = () => { closeSuggestions(); qEl.value=''; openModal(m.id, type); };
      suggEl.appendChild(row);
    });
    // Footer: "See all results"
    const footer = document.createElement('div');
    footer.className = 'sugg-footer';
    footer.textContent = `See all results for "${q}" →`;
    footer.onclick = () => { closeSuggestions(); doSearch(q); };
    suggEl.appendChild(footer);
    suggEl.classList.add('open');
  } catch { closeSuggestions(); }
}

async function doSearch(q){
  qEl.value = q;
  showBrowse(`Results for "${q}"`);
  const grid = document.getElementById('bgrid');
  grid.innerHTML = Array(12).fill('<div class="bskel"></div>').join('');
  try{
    const d = await api('/search/multi', { query: q });
    grid.innerHTML = '';
    const res = (d.results||[]).filter(r=>r.media_type==='movie'||r.media_type==='tv');
    if (!res.length){ grid.innerHTML='<p style="color:var(--muted);grid-column:1/-1">No results found.</p>'; return; }
    res.forEach(m => grid.appendChild(makeBCard(m, m.media_type)));
  } catch { grid.innerHTML='<p style="color:var(--muted)">Search failed. Check your connection.</p>'; }
}

/* ═══════════════════════════════════════════════
   BROWSE LIST
═══════════════════════════════════════════════ */
async function browseList(key){
  const labels={trending:'Trending',popular:'Popular',top_rated:'Top Rated',upcoming:'Upcoming',airing_today:'Airing Today'};
  showBrowse(labels[key]||key);
  const grid=document.getElementById('bgrid');
  grid.innerHTML=Array(16).fill('<div class="bskel"></div>').join('');
  try{
    const paths={
      trending: mode==='movie'?'/trending/movie/week':'/trending/tv/week',
      popular:  mode==='movie'?'/movie/popular':'/tv/popular',
      top_rated:mode==='movie'?'/movie/top_rated':'/tv/top_rated',
      upcoming: '/movie/upcoming',
      airing_today:'/tv/airing_today'
    };
    const d=await api(paths[key]||paths.popular);
    grid.innerHTML='';
    const type=mode;
    (d.results||[]).forEach(m=>grid.appendChild(makeBCard(m,type)));
  }catch{ grid.innerHTML='<p style="color:var(--muted)">Could not load.</p>'; }
}

async function browseGenre(genreId, name){
  showBrowse(name);
  const grid=document.getElementById('bgrid');
  grid.innerHTML=Array(16).fill('<div class="bskel"></div>').join('');
  try{
    const endpoint = mode==='movie' ? '/discover/movie' : '/discover/tv';
    const d=await api(endpoint,{with_genres:genreId,sort_by:'popularity.desc'});
    grid.innerHTML='';
    const type=mode;
    (d.results||[]).forEach(m=>grid.appendChild(makeBCard(m,type)));
  }catch{ grid.innerHTML='<p style="color:var(--muted)">Could not load.</p>'; }
}

function makeBCard(m, type='movie'){
  const el=document.createElement('div');
  el.className='bcrd';
  const poster=m.poster_path
    ? `${IMG}/w342${m.poster_path}`
    : `https://placehold.co/190x285/141924/8a96a8?text=${encodeURIComponent((m.title||m.name||'?').slice(0,10))}`;
  const title=m.title||m.name||'';
  const year=(m.release_date||m.first_air_date||'').split('-')[0];
  el.innerHTML=`
    <img src="${poster}" alt="${title}" loading="lazy">
    ${type==='tv'?'<div class="ctv">SERIES</div>':''}
    <div class="card-ov">
      <div class="card-ttl">${title}</div>
      <div class="card-inf">
        <span class="card-rat">★ ${m.vote_average?.toFixed(1)||'N/A'}</span>
        <span>${year}</span>
      </div>
    </div>`;
  el.onclick=()=>openModal(m.id, type==='movie'?'movie':'tv');
  return el;
}

function showBrowse(title, pushHistory=true){
  if(pushHistory) history.pushState({view:'browse', title}, '');
  document.getElementById('q').value='';
  document.getElementById('home').style.display='none';
  document.getElementById('browse').classList.add('open');
  document.getElementById('browseTitle').textContent=title;
}
function closeBrowse(){
  document.getElementById('browse').classList.remove('open');
  document.getElementById('home').style.display='';
}
function goHome(push=true){
  if(push) history.pushState({view:'home'},'');
  closeBrowse();
  document.getElementById('q').value='';
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
}

// ── BROWSER BACK / FORWARD ────────────────────────────────────────
window.addEventListener('popstate', e => {
  const state = e.state || {};
  // Always close watchlist first
  document.getElementById('watchlistPage').classList.remove('open');
  if (state.view === 'home' || !state.view){ setMobileTab('home');
    closeBrowse();
    document.getElementById('q').value='';
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  } else if (state.view === 'browse'){ setMobileTab(mode==='tv'?'tv':'movies');
    document.getElementById('home').style.display='none';
    document.getElementById('browse').classList.add('open');
    document.getElementById('browseTitle').textContent = state.title||'';
  } else if (state.view === 'watchlist'){ setMobileTab('watchlist');
    document.getElementById('home').style.display='none';
    document.getElementById('watchlistPage').classList.add('open');
    renderWatchlist();
  }
});

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

/* ═══════════════════════════════════════════════
   KEYBOARD
═══════════════════════════════════════════════ */
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closePlayer(); closeModal(); } });


/* ═══════════════════════════════════════════════
   THUMBS UP / DOWN  (stored in localStorage)
═══════════════════════════════════════════════ */
function getVotes(id){ try{ return JSON.parse(localStorage.getItem('votes_'+id))||{up:0,down:0,mine:null}; }catch{ return {up:0,down:0,mine:null}; } }
function saveVotes(id,v){ try{ localStorage.setItem('votes_'+id,JSON.stringify(v)); }catch{} }

function loadVotes(id){
  const v=getVotes(id);
  document.getElementById('upCount').textContent=v.up;
  document.getElementById('downCount').textContent=v.down;
  document.getElementById('voteUp').classList.toggle('voted',v.mine==='up');
  document.getElementById('voteDown').classList.toggle('voted',v.mine==='down');
}

function castVote(dir){
  if(!curId) return;
  const v=getVotes(curId);
  if(v.mine===dir){
    // undo vote
    v[dir]=Math.max(0,v[dir]-1);
    v.mine=null;
  } else {
    if(v.mine){ v[v.mine]=Math.max(0,v[v.mine]-1); }
    v[dir]=(v[dir]||0)+1;
    v.mine=dir;
  }
  saveVotes(curId,v);
  loadVotes(curId);
}

/* ═══════════════════════════════════════════════
   PLAYER HINT — auto-hides after 6s
═══════════════════════════════════════════════ */
let hintTimer=null;
function showPlayerHint(){
  const h=document.getElementById('playerHint');
  h.style.opacity='1';
  clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{ h.style.opacity='0'; },6000);
}

/* ═══════════════════════════════════════════════
   FEEDBACK MODAL
═══════════════════════════════════════════════ */
function openFb(){
  document.getElementById('fbModal').classList.add('open');
  document.body.style.overflow='hidden';
  document.getElementById('fbForm').style.display='';
  document.getElementById('fbSent').style.display='none';
}
function closeFb(){
  document.getElementById('fbModal').classList.remove('open');
  document.body.style.overflow='';
}
function fbBgClose(e){ if(e.target===document.getElementById('fbModal')) closeFb(); }

// ─────────────────────────────────────────────────────────────────
//  FEEDBACK — Web3Forms (works from local files & any hosted domain)
//  Setup (30 sec, one time):
//    1. Go to https://web3forms.com
//    2. Enter gaindu.perera29@gmail.com → click Create Access Key
//    3. Copy the key and paste it below replacing YOUR_ACCESS_KEY
// ─────────────────────────────────────────────────────────────────
const W3F_KEY = 'YOUR_ACCESS_KEY';  // ← paste your Web3Forms key here

async function sendFb(){
  const name = (document.getElementById('fbName').value || 'Anonymous').trim();
  const msg  = document.getElementById('fbMsg').value.trim();
  if (!msg) { document.getElementById('fbMsg').focus(); return; }

  if (W3F_KEY === 'YOUR_ACCESS_KEY') {
    toast('⚠ Add your Web3Forms key — see comment in source.');
    return;
  }

  const sendBtn = document.querySelector('.fbsend');
  sendBtn.textContent = 'Sending…';
  sendBtn.disabled = true;

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: W3F_KEY,
        subject: 'CineStream Feedback from ' + name,
        name,
        message: msg,
        from_name: 'CineStream'
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('fbForm').style.display = 'none';
      document.getElementById('fbSent').style.display = 'block';
      setTimeout(closeFb, 3500);
    } else {
      throw new Error(data.message || 'rejected');
    }
  } catch(e) {
    sendBtn.textContent = 'Send Feedback';
    sendBtn.disabled = false;
    toast('Could not send — check your connection and try again.');
    console.error('Web3Forms error:', e);
  }
}


/* ══════════════════════════════════════════════════════════════
   WATCHLIST  — persisted in localStorage as 'cs_watchlist'
   Stores: { id, type, title, poster_path, vote_average,
             release_date, first_air_date, added_at }
══════════════════════════════════════════════════════════════ */

function getWL(){ try{ return JSON.parse(localStorage.getItem('cs_watchlist'))||[]; }catch{ return []; } }
function saveWL(list){ try{ localStorage.setItem('cs_watchlist', JSON.stringify(list)); }catch{} }
function inWL(id){ return getWL().some(m => m.id === id); }

function updateWLBadge(){
  const n = getWL().length;
  const badge = document.getElementById('wlBadge');
  if(badge){ badge.textContent = n; badge.classList.toggle('show', n > 0); }
  const mb = document.getElementById('mbBadge');
  if(mb){ mb.textContent = n; mb.classList.toggle('show', n > 0); }
}

// Call after modal opens to set button state
function refreshWLBtn(){
  if (!curId) return;
  const btn  = document.getElementById('mwatchlist');
  const text = document.getElementById('wlBtnText');
  const inList = inWL(curId);
  btn.classList.toggle('in-list', inList);
  text.textContent = inList ? 'Remove from Watchlist' : 'Add to Watchlist';
}

function toggleWatchlist(){
  if (!curId) return;
  let list = getWL();
  if (inWL(curId)){
    list = list.filter(m => m.id !== curId);
    toast('Removed from Watchlist');
  } else {
    // Grab data from the currently open modal
    const title   = document.getElementById('mtitle').textContent;
    const poster  = document.getElementById('mimg').src;
    const metaEl  = document.getElementById('mmeta');
    list.unshift({ id: curId, type: curType, title, poster, added_at: Date.now() });
    toast('Added to Watchlist ✓');
  }
  saveWL(list);
  refreshWLBtn();
  updateWLBadge();
}

function clearWatchlist(){
  if (!getWL().length) return;
  if (!confirm('Clear your entire watchlist?')) return;
  saveWL([]);
  updateWLBadge();
  renderWatchlist();
}

// ── WATCHLIST PAGE ────────────────────────────────────────────
function openWatchlist(){
  history.pushState({view:'watchlist'}, '');
  document.getElementById('home').style.display = 'none';
  document.getElementById('browse').classList.remove('open');
  document.getElementById('watchlistPage').classList.add('open');
  renderWatchlist();
}

function closeWatchlist(){
  document.getElementById('watchlistPage').classList.remove('open');
  document.getElementById('home').style.display = '';
}

function renderWatchlist(){
  const list = getWL();
  const grid = document.getElementById('wlGrid');
  grid.innerHTML = '';

  if (!list.length){
    grid.innerHTML = `
      <div class="wl-empty" style="grid-column:1/-1">
        <svg width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        <h3>Your Watchlist is Empty</h3>
        <p>Open any movie or show and tap "Add to Watchlist" to save it here.</p>
      </div>`;
    return;
  }

  list.forEach(m => {
    const card = document.createElement('div');
    card.className = 'wl-card';
    card.innerHTML = `
      <img src="${m.poster}" alt="${m.title}" loading="lazy"
           onerror="this.src='https://placehold.co/190x285/141924/8a96a8?text=${encodeURIComponent(m.title.slice(0,10))}'">
      ${m.type==='tv' ? '<div class="ctv">SERIES</div>' : ''}
      <button class="wl-remove" title="Remove" onclick="event.stopPropagation(); removeFromWL(${m.id})">✕</button>
      <div class="card-ov">
        <div class="card-ttl">${m.title}</div>
      </div>`;
    card.onclick = () => openModal(m.id, m.type);
    grid.appendChild(card);
  });
}

function removeFromWL(id){
  saveWL(getWL().filter(m => m.id !== id));
  updateWLBadge();
  renderWatchlist();
  toast('Removed from Watchlist');
}


/* ══════════════════════════════════════════════════════════════
   CONTINUE WATCHING  — stored in localStorage as 'cs_cw'
   Each entry: { id, type, title, poster, backdrop,
                 season, episode, srcIdx, watched_at }
   Max 20 entries. Most-recent first.
══════════════════════════════════════════════════════════════ */
const CW_MAX = 20;

function getCW(){ try{ return JSON.parse(localStorage.getItem('cs_cw'))||[]; }catch{ return []; } }
function saveCW(list){ try{ localStorage.setItem('cs_cw', JSON.stringify(list)); }catch{} }

function addToCW(entry){
  let list = getCW().filter(m => m.id !== entry.id); // remove existing entry for same title
  list.unshift({ ...entry, watched_at: Date.now() });
  if (list.length > CW_MAX) list = list.slice(0, CW_MAX);
  saveCW(list);
  renderCWRow();
}

function removeCW(id){
  saveCW(getCW().filter(m => m.id !== id));
  renderCWRow();
}

function clearCW(){
  if (!getCW().length) return;
  if (!confirm('Clear your watch history?')) return;
  saveCW([]);
  renderCWRow();
}

function renderCWRow(){
  const list = getCW();
  const section = document.getElementById('cwSection');
  const row     = document.getElementById('cwRow');

  if (!list.length){ section.classList.remove('show'); return; }
  section.classList.add('show');
  row.innerHTML = '';

  list.forEach(m => {
    const isTv     = m.type === 'tv';
    const subLabel = isTv ? `S${String(m.season).padStart(2,'0')} E${String(m.episode).padStart(2,'0')}` : 'Movie';
    const typeClass= isTv ? 'type-tv' : 'type-movie';
    const typeWord = isTv ? 'SERIES' : 'MOVIE';

    // Use backdrop if stored, else fall back to poster
    const thumb = m.backdrop
      ? m.backdrop
      : (m.poster || `https://placehold.co/220x124/141924/8a96a8?text=${encodeURIComponent(m.title.slice(0,10))}`);

    const card = document.createElement('div');
    card.className = 'cw-card';
    card.innerHTML = `
      <img class="cw-thumb" src="${thumb}" alt="${m.title}"
           onerror="this.src='https://placehold.co/220x124/141924/8a96a8?text=${encodeURIComponent(m.title.slice(0,10))}'">
      <div class="cw-play">
        <svg width="16" height="16" fill="var(--bg)" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <button class="cw-rm" title="Remove" onclick="event.stopPropagation(); removeCW(${m.id})">✕</button>
      <div class="cw-info">
        <div class="cw-title">${m.title}</div>
        <div class="cw-sub">
          <span class="type-badge ${typeClass}">${typeWord}</span>
          <span>${subLabel}</span>
        </div>
        <div class="cw-bar"><div class="cw-fill" style="width:100%"></div></div>
      </div>`;

    // Clicking resumes straight into the player
    card.onclick = () => {
      curSeason  = m.season  || 1;
      curEpisode = m.episode || 1;
      openPlayer(m.id, m.type, m.title + (isTv ? ` — S${String(m.season).padStart(2,'0')}E${String(m.episode).padStart(2,'0')}` : ''), m.srcIdx||0);
    };
    row.appendChild(card);
  });
}


/* ══════════════════════════════════════════════════════════════
   MOBILE BOTTOM TAB BAR
══════════════════════════════════════════════════════════════ */
function setMobileTab(tab){
  ['mbHome','mbMovies','mbTV','mbWatchlist'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const map = {home:'mbHome', movies:'mbMovies', tv:'mbTV', watchlist:'mbWatchlist'};
  const el = document.getElementById(map[tab]);
  if (el) el.classList.add('active');
}

// mobile badge synced inside updateWLBadge below

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
(()=>{
  // Seed initial history state so popstate fires correctly on first back press
  history.replaceState({view:'home'}, '');
  updateWLBadge();
  setMobileTab('home');
  renderCWRow();
  initChips();
  loadHero();
  initMovieRows();
})();
