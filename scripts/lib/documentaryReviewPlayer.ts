import { DOCUMENTARY_REVIEW_BAR } from "../../server/video/documentaryProduction";

/** Offline full-film review, packaged beside the exact MP4. No analytics,
 * provider requests, auto-approval or inferred listening from playback events. */
export function documentaryReviewPlayerHtml(input: {
  episodeId: string;
  videoFile: string;
  videoSha256: string;
  inputHash: string;
  shots: Array<{ start: number; title: string; seconds: number }>;
}) {
  const data = JSON.stringify({ ...input, criteria: DOCUMENTARY_REVIEW_BAR }).replaceAll(
    "<",
    "\\u003c"
  );
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Desk · Full-film review</title>
<style>body{margin:0;background:#101923;color:#edf2f5;font:16px/1.5 system-ui}main{max-width:1150px;margin:auto;padding:24px}.layout{display:grid;grid-template-columns:minmax(250px,380px) 1fr;gap:28px}video{width:100%;max-height:78vh;background:#000;position:sticky;top:16px}button,select,textarea,input{font:inherit}button,select{padding:8px;background:#edf2f5;color:#101923;border:0;border-radius:4px}button{cursor:pointer}textarea,input[type=text]{box-sizing:border-box;width:100%;padding:10px}label{display:block;margin:14px 0}select{display:block;margin-top:6px}small{color:#bac8d2}.hash{overflow-wrap:anywhere}.shots{display:flex;gap:8px;flex-wrap:wrap}h1{font-size:26px}h2{font-size:20px}@media(max-width:700px){.layout{grid-template-columns:1fr}video{position:static;max-height:65vh}main{padding:16px}}</style>
<main><h1>The Desk · Full-film review</h1><p>Watch and listen to the complete MP4 on headphones and a phone speaker. Inspect captions and pictures at phone size. Technical checks do not complete this review.</p>
<div class="layout"><div><video id="film" controls playsinline preload="metadata"></video><p><a href="sources.md">Source and picture credits</a> · <a href="technical-review.json">Technical evidence</a></p><p class="hash" id="identity"></p></div>
<div><h2>Timed visual plan</h2><div class="shots" id="shots"></div><p><small>Jump buttons help inspect a passage; they do not count as watching the full film.</small></p>
<form id="review"><h2>Editorial review</h2><label>Reviewer name<input id="reviewer" type="text" maxlength="120" required></label><label><input id="attest" type="checkbox"> I watched and listened to this entire exact export.</label><div id="criteria"></div>
<label>Timestamped observations and corrections<textarea id="notes" rows="5" maxlength="4000" placeholder="00:14 — explain the figure before the next cut…"></textarea></label><button type="button" id="stamp">Insert current time</button>
<label>One change for the next film<textarea id="next" rows="3" maxlength="1500" placeholder="What changes, why, and which evidence will show whether it helped?"></textarea></label>
<p id="message" role="status">All checks start unreviewed.</p><button type="submit">Download review record</button><p><small>This saves a local JSON record. It does not publish, approve a release, or update the admin database. Keep it with this export and register any release only after its separate editorial checks.</small></p></form></div></div></main>
<script id="data" type="application/json">${data}</script><script>
const data=JSON.parse(document.getElementById('data').textContent);
const film=document.getElementById('film');film.src=data.videoFile;
document.getElementById('identity').textContent='Episode: '+data.episodeId+' · MP4 SHA-256: '+data.videoSha256;
const clock=s=>Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');
for(const shot of data.shots){const b=document.createElement('button');b.type='button';b.textContent=clock(shot.start)+' · '+shot.title;b.onclick=()=>{film.currentTime=shot.start;};document.getElementById('shots').append(b);}
for(const criterion of data.criteria){const label=document.createElement('label');label.textContent=criterion.question;const select=document.createElement('select');select.id='check-'+criterion.id;for(const [value,text] of [['pending','Not reviewed'],['pass','Pass'],['fix','Needs work']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}label.append(select);document.getElementById('criteria').append(label);}
document.getElementById('stamp').onclick=()=>{const notes=document.getElementById('notes');notes.value+=(notes.value?'\\n':'')+clock(film.currentTime)+' — ';notes.focus();};
document.getElementById('review').onsubmit=event=>{event.preventDefault();const checks=Object.fromEntries(data.criteria.map(c=>[c.id,document.getElementById('check-'+c.id).value]));const watchedAndListened=document.getElementById('attest').checked;const notes=document.getElementById('notes').value.trim();const message=document.getElementById('message');if(Object.values(checks).includes('pass')&&!watchedAndListened){message.textContent='A passing review requires your full-watch and full-listen attestation.';return;}if(Object.values(checks).includes('fix')&&!notes){message.textContent='Describe the correction and its timestamp.';return;}const review={version:1,episodeId:data.episodeId,videoSha256:data.videoSha256,inputHash:data.inputHash,reviewer:document.getElementById('reviewer').value.trim(),reviewedAt:new Date().toISOString(),watchedAndListened,checks,notes,nextTest:document.getElementById('next').value.trim(),status:watchedAndListened&&Object.values(checks).every(x=>x==='pass')?'human-review-complete':'review-incomplete',published:false};const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=data.episodeId+'-human-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message.textContent='Review downloaded. Keep it with the exact export; no release has been approved.';};
</script></html>`;
}
