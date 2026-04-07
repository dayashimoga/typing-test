(() => {
'use strict';
const WORD_LISTS = {
easy: ['the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','come','could','than','look','day','has','more','some','very','after','thing','our','also','how','first','new','good','way','find','give','most','tell','work','call','try','ask','need','too','any','right','use','each','old','long','down','own','still','should','well','back','over','after','year'],
medium: ['algorithm','interface','variable','function','database','component','framework','structure','protocol','security','application','development','middleware','repository','container','deployment','synchronize','configuration','implement','performance','authentication','authorization','integration','documentation','architecture','polymorphism','inheritance','abstraction','encapsulation','optimization'],
hard: ['ephemeral','ubiquitous','idempotent','asynchronous','polymorphism','concatenation','serialization','deserialization','memoization','virtualization','containerization','infrastructure','microservices','orchestration','observability','telemetry','interoperability','decentralized','cryptographic','deterministic'],
code: ['const data = await fetch(url);','function merge(a, b) { return {...a, ...b}; }','arr.filter(x => x > 0).map(x => x * 2);','if (err) throw new Error(msg);','export default class App extends Component {}','const [state, setState] = useState(null);','Object.keys(obj).forEach(key => {});','try { await save(data); } catch(e) {}','return arr.reduce((sum, n) => sum + n, 0);','const result = items?.find(i => i.id === id);']
};
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);
let state={duration:30,difficulty:'easy',timer:null,timeLeft:30,started:false,finished:false,text:'',charIndex:0,errors:0,correctChars:0,wpmHistory:[],startTime:null,ghostWpm:[]};

// ── Per-Key Accuracy Tracking ──
let keyStats = JSON.parse(localStorage.getItem('typing_key_stats') || '{}');

function trackKey(expected, actual) {
  const key = expected.toLowerCase();
  if (!keyStats[key]) keyStats[key] = { correct: 0, errors: 0 };
  if (expected === actual) keyStats[key].correct++;
  else keyStats[key].errors++;
  localStorage.setItem('typing_key_stats', JSON.stringify(keyStats));
}

const textDisplay=$('#textDisplay'),typingInput=$('#typingInput'),wpmDisplay=$('#wpmDisplay'),accuracyDisplay=$('#accuracyDisplay'),timeDisplay=$('#timeDisplay'),charDisplay=$('#charDisplay'),progressFill=$('#progressFill');

function generateText(){
  const words=WORD_LISTS[state.difficulty];
  if(state.difficulty==='code') return words.sort(()=>Math.random()-0.5).slice(0,6).join('\n');
  const count=state.duration<=30?40:state.duration<=60?70:120;
  return Array.from({length:count},()=>words[Math.floor(Math.random()*words.length)]).join(' ');
}

function renderText(){
  state.text=generateText();state.charIndex=0;state.errors=0;state.correctChars=0;state.wpmHistory=[];state.started=false;state.finished=false;state.timeLeft=state.duration;
  timeDisplay.textContent=state.timeLeft;wpmDisplay.textContent='0';accuracyDisplay.textContent='100%';charDisplay.textContent='0';progressFill.style.width='0%';
  textDisplay.innerHTML=state.text.split('').map((c,i)=>`<span class="char${i===0?' current':''}" data-i="${i}">${c==='\n'?'↵\n':c}</span>`).join('');
  typingInput.value='';typingInput.disabled=false;typingInput.focus();
  $('#resultsCard').style.display='none';
  clearInterval(state.timer);
  // Load ghost data
  loadGhostData();
}

// ── Ghost Race Mode ──
function loadGhostData() {
  const history = JSON.parse(localStorage.getItem('typing_history') || '[]');
  const best = history.filter(r => r.difficulty === state.difficulty && r.duration === state.duration)
    .sort((a, b) => b.wpm - a.wpm)[0];
  state.ghostWpm = best ? (best.wpmTimeline || []) : [];
  const ghostEl = $('#ghostWpm');
  if (ghostEl) ghostEl.textContent = best ? best.wpm : '-';
}

function startTimer(){
  state.started=true;state.startTime=Date.now();
  state.timer=setInterval(()=>{
    state.timeLeft--;timeDisplay.textContent=state.timeLeft;
    progressFill.style.width=((state.duration-state.timeLeft)/state.duration*100)+'%';
    const elapsed=(Date.now()-state.startTime)/60000;
    const wpm=Math.round((state.correctChars/5)/Math.max(elapsed,0.01));
    wpmDisplay.textContent=wpm;state.wpmHistory.push(wpm);
    // Ghost comparison
    updateGhostRace(state.wpmHistory.length - 1, wpm);
    if(state.timeLeft<=0)finishTest();
  },1000);
}

function updateGhostRace(idx, currentWpm) {
  const ghostBar = $('#ghostProgress');
  const ghostLabel = $('#ghostDelta');
  if (!ghostBar || !state.ghostWpm.length) return;
  const ghostWpmNow = state.ghostWpm[idx] || state.ghostWpm[state.ghostWpm.length - 1] || 0;
  const delta = currentWpm - ghostWpmNow;
  ghostBar.style.width = Math.min(100, (idx / state.duration) * 100) + '%';
  if (ghostLabel) {
    ghostLabel.textContent = delta >= 0 ? `+${delta} WPM` : `${delta} WPM`;
    ghostLabel.className = 'ghost-delta ' + (delta >= 0 ? 'ahead' : 'behind');
  }
}

function finishTest(){
  clearInterval(state.timer);state.finished=true;typingInput.disabled=true;
  const elapsed=(Date.now()-state.startTime)/60000;
  const finalWpm=Math.round((state.correctChars/5)/Math.max(elapsed,0.01));
  const totalTyped=state.correctChars+state.errors;
  const accuracy=totalTyped>0?Math.round((state.correctChars/totalTyped)*100):100;
  $('#finalWpm').textContent=finalWpm;$('#finalAccuracy').textContent=accuracy+'%';$('#finalChars').textContent=state.correctChars;$('#finalErrors').textContent=state.errors;
  $('#resultsCard').style.display='block';
  saveResult({wpm:finalWpm,accuracy,chars:state.correctChars,errors:state.errors,duration:state.duration,difficulty:state.difficulty,date:new Date().toISOString(),wpmTimeline:state.wpmHistory});
  renderChart(state.wpmHistory);updateHistory();updateLeaderboard();renderKeyboardHeatmap();
}

function saveResult(r){const h=JSON.parse(localStorage.getItem('typing_history')||'[]');h.unshift(r);if(h.length>100)h.length=100;localStorage.setItem('typing_history',JSON.stringify(h));
  const today=new Date().toDateString();const lastDate=localStorage.getItem('typing_last_date');
  if(lastDate!==today){const streak=lastDate===new Date(Date.now()-86400000).toDateString()?parseInt(localStorage.getItem('typing_streak')||'0')+1:1;
  localStorage.setItem('typing_streak',streak);localStorage.setItem('typing_last_date',today);}
}

function renderChart(data){
  const ctx=$('#wpmChart');if(!ctx)return;
  if(window._wpmChart)window._wpmChart.destroy();
  const datasets = [{label:'WPM',data,borderColor:'#6c5ce7',backgroundColor:'rgba(108,92,231,0.1)',fill:true,tension:0.4,pointRadius:0}];
  // Add ghost line if available
  if (state.ghostWpm.length > 0) {
    datasets.push({label:'Personal Best',data:state.ghostWpm.slice(0, data.length),borderColor:'rgba(239,68,68,0.5)',borderDash:[5,5],fill:false,tension:0.4,pointRadius:0});
  }
  window._wpmChart=new Chart(ctx,{type:'line',data:{labels:data.map((_,i)=>i+1+'s'),datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:state.ghostWpm.length>0,labels:{color:'var(--text-muted)'}}},scales:{x:{display:false},y:{beginAtZero:true,grid:{color:'rgba(255,255,255,0.05)'}}}}});
}

function updateHistory(){
  const h=JSON.parse(localStorage.getItem('typing_history')||'[]');
  if(!h.length)return;
  const wpmArr=h.map(r=>r.wpm);
  $('#bestWpm').textContent=Math.max(...wpmArr);
  $('#avgWpm').textContent=Math.round(wpmArr.reduce((a,b)=>a+b,0)/wpmArr.length);
  $('#testCount').textContent=h.length;
  $('#streak').textContent=(localStorage.getItem('typing_streak')||'0')+' 🔥';
  const ctx=$('#historyChart');if(!ctx)return;
  if(window._histChart)window._histChart.destroy();
  const recent=h.slice(0,20).reverse();
  window._histChart=new Chart(ctx,{type:'bar',data:{labels:recent.map((_,i)=>'#'+(i+1)),datasets:[{label:'WPM',data:recent.map(r=>r.wpm),backgroundColor:'rgba(108,92,231,0.5)',borderColor:'#6c5ce7',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(255,255,255,0.05)'}},x:{grid:{display:false}}}}});
}

function updateLeaderboard(){
  const h=JSON.parse(localStorage.getItem('typing_history')||'[]');
  const sorted=[...h].sort((a,b)=>b.wpm-a.wpm).slice(0,10);
  const tbody=$('#lbBody');
  tbody.innerHTML=sorted.map((r,i)=>`<tr><td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td><td>${r.wpm}</td><td>${r.accuracy}%</td><td>${r.duration}s</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No results yet. Take a test!</td></tr>';
}

// ── Keyboard Heatmap ──
const KEYBOARD_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m']
];

function renderKeyboardHeatmap() {
  let heatmapEl = $('#keyboardHeatmap');
  if (!heatmapEl) {
    // Create heatmap section dynamically
    const section = document.createElement('section');
    section.className = 'glass-card mt-4';
    section.id = 'heatmapSection';
    section.innerHTML = '<h2>🎯 Keyboard Accuracy Heatmap</h2><p class="text-muted" style="font-size:0.8rem;margin-bottom:1rem">Colors show your per-key accuracy — green = strong, red = needs practice</p><div id="keyboardHeatmap" class="keyboard-heatmap"></div>';
    const history = $('#history');
    if (history) history.parentNode.insertBefore(section, history);
    heatmapEl = $('#keyboardHeatmap');
  }
  if (!heatmapEl) return;

  let html = '';
  KEYBOARD_ROWS.forEach(row => {
    html += '<div class="kb-row">';
    row.forEach(key => {
      const stats = keyStats[key] || { correct: 0, errors: 0 };
      const total = stats.correct + stats.errors;
      const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : -1;
      let color, label;
      if (accuracy === -1) { color = 'var(--bg-card)'; label = '-'; }
      else if (accuracy >= 95) { color = '#10b981'; label = accuracy + '%'; }
      else if (accuracy >= 85) { color = '#f59e0b'; label = accuracy + '%'; }
      else { color = '#ef4444'; label = accuracy + '%'; }
      html += `<div class="kb-key" style="background:${color}" title="${key.toUpperCase()}: ${total} typed, ${accuracy === -1 ? 'no data' : accuracy + '% accurate'}">
        <span class="kb-letter">${key.toUpperCase()}</span>
        <span class="kb-acc">${label}</span>
      </div>`;
    });
    html += '</div>';
  });
  heatmapEl.innerHTML = html;
}

// ── Input Handler ──
typingInput.addEventListener('input',e=>{
  if(!state.started&&!state.finished)startTimer();
  const chars=textDisplay.querySelectorAll('.char');
  const typed=typingInput.value;
  const lastChar=typed[typed.length-1];
  if(state.charIndex<state.text.length){
    const expected=state.text[state.charIndex];
    trackKey(expected, lastChar);
    if(lastChar===expected){chars[state.charIndex].classList.remove('current');chars[state.charIndex].classList.add('correct');state.correctChars++;state.charIndex++;}
    else{chars[state.charIndex].classList.remove('current');chars[state.charIndex].classList.add('incorrect');state.errors++;state.charIndex++;}
    if(state.charIndex<state.text.length)chars[state.charIndex].classList.add('current');
    typingInput.value='';
    charDisplay.textContent=state.correctChars;
    const total=state.correctChars+state.errors;
    accuracyDisplay.textContent=(total>0?Math.round(state.correctChars/total*100):100)+'%';
    if(state.charIndex>=state.text.length)finishTest();
  }
});
typingInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&state.difficulty==='code'){
    e.preventDefault();
    typingInput.value+='\n';
    typingInput.dispatchEvent(new Event('input'));
  }
});

// ── Controls ──
$$('#durationBtns button').forEach(btn=>btn.addEventListener('click',()=>{$$('#durationBtns button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.duration=parseInt(btn.dataset.val);renderText();}));
$$('#difficultyBtns button').forEach(btn=>btn.addEventListener('click',()=>{$$('#difficultyBtns button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.difficulty=btn.dataset.val;renderText();}));
$('#restartBtn').addEventListener('click',renderText);
$('#newTextBtn').addEventListener('click',renderText);
$('#tryAgainBtn').addEventListener('click',()=>{renderText();window.scrollTo({top:0,behavior:'smooth'});});

// ── Theme (uses shared lib if available, fallback for standalone) ──
if (typeof QU !== 'undefined') { QU.initTheme(); }
else {
  $('#themeBtn').addEventListener('click',()=>{const html=document.documentElement;const isDark=html.dataset.theme==='dark';html.dataset.theme=isDark?'light':'dark';$('#themeBtn').textContent=isDark?'☀️':'🌙';localStorage.setItem('theme',html.dataset.theme);});
  if(localStorage.getItem('theme')==='light'){document.documentElement.dataset.theme='light';$('#themeBtn').textContent='☀️';}
}

// ── Init ──
renderText();updateHistory();updateLeaderboard();renderKeyboardHeatmap();
})();
