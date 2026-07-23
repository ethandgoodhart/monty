// Serves the Monterey Select application form as a standalone page at /apply.
const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Apply · Monterey Select</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" href="/monty-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    color-scheme: light;
    --bg:#FFFFFF; --ink:#0A0B0C; --ink-2:#3A3D43; --muted:#5C6068; --faint:#8B9099;
    --line:#EAEBEE; --line-2:#DFE1E5; --wash:#F7F8F9;
    --accent:#0E7A54; --accent-2:#109063; --accent-ink:#0A5C3F; --accent-soft:#E7F3EE;
    --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:16px; line-height:1.5; letter-spacing:-.013em; -webkit-font-smoothing:antialiased}
  .bar{border-bottom:1px solid var(--line)}
  .bar-in{max-width:600px; margin:0 auto; padding:0 24px; height:62px; display:flex; align-items:center; justify-content:space-between}
  .brand{display:flex; align-items:center; gap:9px; font-weight:640; font-size:15px; letter-spacing:-.02em; color:var(--ink); text-decoration:none}
  .brand img{width:22px; height:22px; object-fit:contain; display:block}
  .brand .prog{color:var(--muted); font-weight:460}
  .nav-btn{font-size:14px; font-weight:520; color:var(--ink); background:#fff; border:1px solid var(--line-2); text-decoration:none; padding:9px 15px; border-radius:9px; transition:border-color .15s, background .15s}
  .nav-btn:hover{border-color:var(--ink); background:var(--wash)}
  @media (max-width:420px){ .brand .prog{display:none} }
  main{max-width:600px; margin:0 auto; padding:56px 24px 90px}

  h1{font-size:clamp(28px,5vw,36px); font-weight:720; letter-spacing:-.03em; line-height:1.08; margin:0}
  .sub{color:var(--muted); font-size:15.5px; margin:14px 0 34px; max-width:52ch}

  form{display:grid; gap:20px}
  .row2{display:grid; grid-template-columns:1fr 1fr; gap:16px}
  .inp label, .qlabel{display:block; font-size:13.5px; color:var(--ink-2); font-weight:540; margin-bottom:9px; letter-spacing:-.005em}
  .inp input{width:100%; font-family:var(--sans); font-size:15.5px; color:var(--ink); background:#fff; border:1px solid var(--line-2); border-radius:10px; padding:13px 14px; letter-spacing:-.01em; transition:border-color .15s, box-shadow .15s}
  .inp input::placeholder{color:var(--faint)}
  .inp input:focus{outline:none; border-color:var(--ink); box-shadow:0 0 0 3px rgba(10,11,12,.06)}
  .inp select{width:100%; font-family:var(--sans); font-size:15.5px; color:var(--ink); background:#fff; border:1px solid var(--line-2); border-radius:10px; padding:13px 42px 13px 14px; letter-spacing:-.01em; cursor:pointer; -webkit-appearance:none; -moz-appearance:none; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%235C6068' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; transition:border-color .15s, box-shadow .15s}
  .inp select:hover{border-color:var(--ink)}
  .inp select:focus{outline:none; border-color:var(--ink); box-shadow:0 0 0 3px rgba(10,11,12,.06)}
  .inp select:required:invalid{color:var(--faint)}
  .inp select option{color:var(--ink)}
  .seg{display:flex; flex-wrap:wrap; gap:9px}
  .seg button{flex:1 1 auto; min-width:96px; font-family:var(--sans); font-size:14px; color:var(--ink-2); background:#fff; border:1px solid var(--line-2); border-radius:10px; padding:12px 10px; cursor:pointer; transition:all .14s; font-weight:480; text-align:center; line-height:1.35}
  .seg.col{flex-direction:column}
  .seg.col button{flex:none; width:100%; text-align:left; padding:13px 15px}
  .seg button:hover{border-color:var(--ink)}
  .seg button[aria-pressed=true]{background:var(--ink); border-color:var(--ink); color:#fff; font-weight:560}
  .submit{font-family:var(--sans); font-size:16px; font-weight:600; color:#fff; background:var(--ink); border:none; border-radius:11px; padding:16px 20px; cursor:pointer; transition:opacity .12s, transform .1s; letter-spacing:-.01em; margin-top:4px}
  .submit:hover{opacity:.9}
  .submit:active{transform:translateY(1px)}
  .submit:focus-visible{outline:none; box-shadow:0 0 0 4px rgba(10,11,12,.12)}
  .fnote{text-align:center; font-size:12.5px; color:var(--faint); margin-top:4px}

  .verdict{display:none}
  .verdict.show{display:block; animation:rise .4s cubic-bezier(.2,.7,.2,1) both}
  @keyframes rise{from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none}}
  .verdict .vt{font-size:24px; font-weight:700; letter-spacing:-.025em; margin:0 0 12px}
  .verdict.ok .vt{color:var(--accent-ink)}
  .vcheck{width:52px; height:52px; border-radius:50%; background:var(--accent); position:relative; display:none; margin:0 0 18px}
  .verdict.sent .vcheck{display:block; animation:pop .42s cubic-bezier(.2,.8,.3,1.25) both}
  .vcheck::after{content:""; position:absolute; left:19px; top:13px; width:10px; height:19px; border:solid #fff; border-width:0 3px 3px 0; transform:rotate(45deg)}
  @keyframes pop{from{opacity:0; transform:scale(.4)} to{opacity:1; transform:scale(1)}}
  .verdict p{color:var(--muted); font-size:15.5px; margin:0 0 24px; line-height:1.55}
  .mailbtn{display:inline-flex; align-items:center; gap:9px; font-size:15.5px; font-weight:600; color:#fff; background:var(--accent); border-radius:11px; padding:15px 24px; text-decoration:none; transition:background .15s}
  .mailbtn:hover{background:var(--accent-2)}
  .restart{display:block; margin-top:18px; background:none; border:none; color:var(--muted); font-size:13.5px; cursor:pointer; text-decoration:underline; padding:0}

  @media (max-width:560px){ .row2{grid-template-columns:1fr} main{padding:40px 20px 70px} }
  @media (prefers-reduced-motion:reduce){*{animation:none !important; transition:none !important}}
</style>
</head>
<body>

<header class="bar">
  <div class="bar-in">
    <a class="brand" href="/"><img src="/monty-logo.png" alt="Monty" width="22" height="22">Monty <span class="prog">Monterey Select</span></a>
    <a class="nav-btn" href="https://frontier-firms.vercel.app/#calc">Calculate earnings</a>
  </div>
</header>

<main>
  <h1>Apply to the founding cohort.</h1>
  <p class="sub">A few quick questions so we don&rsquo;t waste your time or ours. We reply within 48 hours, and applying commits you to nothing.</p>

  <form id="frm" novalidate>
    <div class="row2">
      <div class="inp"><label for="firm">Firm name</label><input id="firm" type="text" placeholder="Acme Advisory" autocomplete="organization"></div>
      <div class="inp"><label for="name">Your name</label><input id="name" type="text" placeholder="Jane Doe" autocomplete="name"></div>
    </div>
    <div class="row2">
      <div class="inp"><label for="email">Work email</label><input id="email" type="email" placeholder="jane@acme.com" autocomplete="email"></div>
      <div class="inp"><label for="phone">Phone</label><input id="phone" type="tel" placeholder="(555) 123-4567" autocomplete="tel"></div>
    </div>

    <div class="inp"><label for="mix">Your practice is mostly&hellip;</label>
      <select id="mix" required>
        <option value="" selected disabled hidden>Select one&hellip;</option>
        <option value="advisory">Advisory &amp; client accounting (CAS, fractional CFO, bookkeeping)</option>
        <option value="mix">A mix of advisory and tax/audit</option>
        <option value="tax">Mostly tax &amp; audit</option>
      </select>
    </div>
    <div class="inp"><label for="work">How is your day-to-day accounting work done today?</label>
      <select id="work" required>
        <option value="" selected disabled hidden>Select one&hellip;</option>
        <option value="clean">Our people do all the accounting</option>
        <option value="assist">Some AI suggests, but a person reviews</option>
        <option value="ai">AI does most of the work, we just review</option>
      </select>
    </div>
    <div class="inp"><label for="tools">What accounting software do your clients mainly run on?</label>
      <select id="tools" required>
        <option value="" selected disabled hidden>Select one&hellip;</option>
        <option value="qbo">QuickBooks</option>
        <option value="xero">Xero</option>
        <option value="netsuite">NetSuite</option>
        <option value="intacct">Sage Intacct</option>
        <option value="mixed">Several / varies by client</option>
        <option value="other">Other</option>
      </select>
    </div>

    <button class="submit" type="submit">Submit application</button>
    <div class="fnote">No cost, no obligation. Advisory and accounting scope only.</div>
  </form>

  <div class="verdict" id="verdict">
    <div class="vcheck" aria-hidden="true"></div>
    <div class="vt" id="vt"></div>
    <p id="vb"></p>
    <a class="mailbtn" id="vmail" href="#">Send my application &rarr;</a>
    <button class="restart" id="restart" type="button">Start over</button>
  </div>
</main>

<script>
(function(){
  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  var $=function(id){return document.getElementById(id)};
  var frm=$('frm'), verdict=$('verdict'), mailBtn=$('vmail');
  var ENDPOINT='https://formsubmit.co/ajax/founders@trymonty.ai';

  frm.addEventListener('submit',function(e){
    e.preventDefault();
    var firm=$('firm').value.trim(), name=$('name').value.trim(), email=$('email').value.trim(), phone=$('phone').value.trim();
    var textMiss=[$('firm'),$('name'),$('email'),$('phone')].find(function(i){return !i.value.trim()});
    if(textMiss||!/.+@.+\..+/.test(email)){ (textMiss||$('email')).focus(); return; }
    var mix=$('mix').value, work=$('work').value, tools=$('tools').value;
    var selMiss=[$('mix'),$('work'),$('tools')].find(function(s){return !s.value});
    if(selMiss){ selMiss.focus(); return; }

    var ok=true, headline, body, tag;
    if(mix==='tax'){ ok=false; tag='declined_scope'; headline='This cohort is built for advisory-led firms.';
      body='Your practice leans toward tax and audit, which sits outside what this program captures. We’ve saved your details and will reach out if we open those lanes.'; }
    else if(work==='ai'){ ok=false; tag='declined_ai_contaminated'; headline='You’re further ahead than most.';
      body='AI already runs much of your substantive work, which is great for your firm. But this program captures human-led workflows, so those recordings wouldn’t fit what we collect right now. We’ve saved your details for what comes next.'; }
    else { ok=true; tag='qualified'; headline='Thanks, '+firm+'.';
      body='We’ve got your application and will reply within 48 hours with next steps and your 60-day pilot terms.'
        + (work==='assist' ? ' One thing we’ll confirm on the call: that your people still drive the judgment on the work we’d record.' : ''); }

    var subject='Monterey Select — '+tag+' — '+firm;
    var payload={ _subject:subject, _template:'table', _captcha:'false',
      Firm:firm, Name:name, Email:email, Phone:phone, Practice:mix, Work_process:work, Software:tools, Screen:tag };

    mailBtn.style.display='none';
    fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)})
      .then(function(){ verdict.classList.add('sent'); })
      .catch(function(){
        var lines=['Firm: '+firm,'Contact: '+name+' <'+email+'>','Phone: '+phone,'Practice: '+mix,'Work process: '+work,'Software: '+tools,'Screen: '+tag];
        mailBtn.href='mailto:founders@trymonty.ai?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\n'));
        mailBtn.style.display='inline-flex';
      });

    $('vt').textContent=headline; $('vb').textContent=body;
    verdict.className='verdict show '+(ok?'ok':'');
    frm.style.display='none';
    verdict.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  });
  $('restart').addEventListener('click',function(){verdict.className='verdict'; frm.style.display='grid'; $('mix').selectedIndex=0; $('work').selectedIndex=0; $('tools').selectedIndex=0; window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});});
})();
</script>
</body>
</html>
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
