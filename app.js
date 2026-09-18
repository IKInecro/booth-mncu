// ponytail: plain JS, no emoji, SVG icons, kiri frame langsung keisi, kanan kamera rasio ngikut slot
const $ = s => document.querySelector(s)
const views = {
  gate: $('#view-gate'),
  frames: $('#view-frames'),
  booth: $('#view-booth'),
  result: $('#view-result'),
}
function show(k){
  Object.entries(views).forEach(([name,el])=> el.hidden = name!==k)
}
let stream=null
let frames=[]
let selected=null
let photosCanvases=[]

const video=$('#video')
const videoWrap=$('#video-wrap')
const slotLayer=$('#slot-layer')
const framePreviewImg=$('#frame-preview-img')
const countdownEl=$('#countdown')
const flashEl=$('#flash')
const progressEl=$('#progress')
const boothHint=$('#booth-hint')
const boothTitle=$('#booth-title')
const boothStep=$('#booth-step')
const badgeText=$('#badge-text')
const btnCapture=$('#btn-capture')
const captureText=$('#capture-text')
const resultImg=$('#result-img')
const finalCanvas=$('#final-canvas')

$('#btn-allow').onclick = async ()=>{
  const msg=$('#gate-msg')
  msg.hidden=true; msg.textContent=''
  try{
    const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}}, audio:false})
    s.getTracks().forEach(t=>t.stop())
    stream=null
    show('frames')
  }catch(e){
    msg.hidden=false
    const name=e?.name||''
    if(name==='NotAllowedError' || name==='PermissionDeniedError'){
      msg.textContent='Akses ditolak. Klik ikon gembok di address bar → Allow Camera → lalu Coba Lagi.'
    }else if(name==='NotFoundError'){
      msg.textContent='Kamera tidak ditemukan.'
    }else if(location.protocol!=='https:' && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'){
      msg.textContent='Butuh HTTPS atau localhost untuk kamera.'
    }else{
      msg.textContent='Gagal buka kamera: '+(e.message||name)
    }
    $('#btn-allow').innerHTML='Coba Lagi <svg class="icon icon-sm"><use href="#i-camera"/></svg>'
  }
}
$('#btn-back-to-gate').onclick=()=> show('gate')

async function loadFrames(){
  const res = await fetch('./frames.json')
  frames = await res.json()
  const grid=$('#frame-grid')
  grid.innerHTML=''
  frames.forEach(f=>{
    const card=document.createElement('button')
    card.className='frame-card'
    card.innerHTML=`<img src="${f.src}" alt="${f.name}" loading="lazy"><b>${f.name}</b><span>${f.slots.length} foto • ${f.w}×${f.h}</span>`
    card.onclick=()=> selectFrame(f)
    grid.appendChild(card)
  })
}
function selectFrame(f){
  selected=f
  photosCanvases=[]
  boothTitle.textContent = f.name
  // set frame preview image
  framePreviewImg.src = f.src
  // set preview aspect to frame ratio
  const preview=$('#frame-preview')
  preview.style.aspectRatio = `${f.w}/${f.h}`
  // kamera rasio ngikut slot pertama
  const ratio = f.slots[0] ? (f.slots[0].w / f.slots[0].h) : 3/4
  videoWrap.style.aspectRatio = String(ratio)
  buildSlots()
  renderProgress()
  show('booth')
  startCamera()
}
function buildSlots(){
  slotLayer.innerHTML=''
  if(!selected) return
  const W=selected.w, H=selected.h
  selected.slots.forEach((s, i)=>{
    const el=document.createElement('div')
    el.className='slot empty'
    el.dataset.idx=i
    // posisi skala ke 100% (frame preview width = 100%)
    el.style.left = (s.x / W * 100) + '%'
    el.style.top = (s.y / H * 100) + '%'
    el.style.width = (s.w / W * 100) + '%'
    el.style.height = (s.h / H * 100) + '%'
    const canvas = photosCanvases[i]
    if(canvas){
      el.classList.remove('empty')
      el.classList.add('filled')
      const img=document.createElement('img')
      img.src = canvas.toDataURL('image/jpeg',0.85)
      el.appendChild(img)
    }else{
      const isActive = i===photosCanvases.length
      if(isActive) el.classList.add('active')
      const span=document.createElement('span')
      span.textContent = isActive ? 'Slot '+(i+1)+' siap' : 'Slot '+(i+1)
      el.appendChild(span)
    }
    slotLayer.appendChild(el)
  })
}

$('#btn-change-frame').onclick=()=>{
  stopCamera()
  show('frames')
}
$('#btn-change-frame2').onclick=()=>{
  show('frames')
}
function renderProgress(){
  if(!selected) return
  const n=selected.slots.length
  const cur=photosCanvases.length
  progressEl.innerHTML=''
  for(let i=0;i<n;i++){
    const d=document.createElement('div')
    d.className='dot'+(i<cur?' done':'')+(i===cur?' active':'')
    progressEl.appendChild(d)
  }
  boothStep.textContent = `${cur}/${n}`
  badgeText.textContent = cur>=n ? 'Selesai' : 'Slot '+(cur+1)+' dari '+n
  boothHint.textContent = cur>=n ? 'Strip penuh — lihat hasil' : 'Pose di kamera kanan, foto akan masuk ke slot kiri'
  captureText.textContent = cur>=n ? 'Lihat Hasil' : 'Ambil Foto'
  btnCapture.disabled = false
  $('#btn-retake').hidden = cur===0
  buildSlots()
}

async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}}, audio:false})
    video.srcObject=stream
    await video.play()
  }catch(e){
    alert('Gagal nyalakan kamera: '+(e.message||e.name))
    show('gate')
  }
}
function stopCamera(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null }
  video.srcObject=null
}
function captureToCanvas(){
  const vw=video.videoWidth, vh=video.videoHeight
  if(!vw||!vh) return null
  const c=document.createElement('canvas')
  c.width=vw; c.height=vh
  const ctx=c.getContext('2d')
  ctx.translate(vw,0); ctx.scale(-1,1)
  ctx.drawImage(video,0,0,vw,vh)
  return c
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function doCountdown(){
  countdownEl.hidden=false
  for(let n=3;n>=1;n--){
    countdownEl.textContent=n
    await sleep(700)
  }
  countdownEl.textContent=' '
  await sleep(220)
  countdownEl.hidden=true
}
function doFlash(){
  flashEl.hidden=false
  setTimeout(()=> flashEl.hidden=true, 280)
}
btnCapture.onclick = async ()=>{
  if(!selected) return
  if(photosCanvases.length>=selected.slots.length){
    await composeAndShow()
    return
  }
  btnCapture.disabled=true
  await doCountdown()
  const cap = captureToCanvas()
  if(!cap){ btnCapture.disabled=false; return }
  doFlash()
  photosCanvases.push(cap)
  renderProgress()
  btnCapture.disabled=false
  if(photosCanvases.length>=selected.slots.length){
    await sleep(420)
    await composeAndShow()
  }
}
$('#btn-retake').onclick=()=>{
  photosCanvases.pop()
  renderProgress()
}
async function composeAndShow(){
  if(!selected || photosCanvases.length===0) return
  const W=selected.w, H=selected.h
  finalCanvas.width=W; finalCanvas.height=H
  const ctx=finalCanvas.getContext('2d')
  ctx.fillStyle='#fff'
  ctx.fillRect(0,0,W,H)
  for(let i=0;i<photosCanvases.length;i++){
    const slot=selected.slots[i]
    if(!slot) break
    drawCover(ctx, photosCanvases[i], slot.x, slot.y, slot.w, slot.h)
  }
  const frameImg = await loadImage(selected.src)
  ctx.drawImage(frameImg,0,0,W,H)
  resultImg.src=finalCanvas.toDataURL('image/png')
  stopCamera()
  show('result')
}
function drawCover(ctx, src, dx, dy, dw, dh){
  const sw=src.width, sh=src.height
  const srcRatio=sw/sh, dstRatio=dw/dh
  let sx=0,sy=0,swCrop=sw,shCrop=sh
  if(srcRatio > dstRatio){
    swCrop = sh * dstRatio
    sx = (sw - swCrop)/2
  }else{
    shCrop = sw / dstRatio
    sy = (sh - shCrop)/2
  }
  ctx.drawImage(src, sx, sy, swCrop, shCrop, dx, dy, dw, dh)
}
function loadImage(src){
  return new Promise((res,rej)=>{
    const img=new Image()
    img.onload=()=>res(img)
    img.onerror=rej
    img.src=src
  })
}
$('#btn-download').onclick=()=>{
  const a=document.createElement('a')
  a.download=`photobooth-${selected?.id||'strip'}-${Date.now()}.png`
  a.href=finalCanvas.toDataURL('image/png')
  a.click()
}
$('#btn-restart').onclick=()=>{
  photosCanvases=[]
  resultImg.src=''
  // rebuild preview + kamera rasio tetap
  renderProgress()
  show('booth')
  startCamera()
}
loadFrames()
show('gate')
// ghost wandering — dari web-jualan
;(function(){
  const ghost=document.getElementById('ghost')
  const gate=document.getElementById('view-gate')
  if(!ghost||!gate) return
  const palette=['#22C55E','#0038FF','#FF4D8D','#FACC15','#EF4444']
  let last=-1
  setInterval(()=>{
    let i;do{i=Math.floor(Math.random()*palette.length)}while(i===last)
    last=i;ghost.style.setProperty('--ghost',palette[i])
  },600)
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  ghost.style.left='12%';ghost.style.top='18%'
  let lastX=0
  function wander(){
    const delay=1200+Math.random()*1800
    const dur=(0.9+Math.random()*0.9).toFixed(2)
    ghost.style.transition=`left ${dur}s ease, top ${dur}s ease, transform .25s ease`
    const rect=gate.getBoundingClientRect()
    const gw=ghost.offsetWidth||140
    const gh=ghost.offsetHeight||140
    const maxX=Math.max(0,rect.width-gw-20)
    const maxY=Math.max(0,rect.height-gh-20)
    const x=Math.random()*maxX
    const y=Math.random()*maxY
    if(x>lastX) ghost.classList.add('facing-right')
    else ghost.classList.remove('facing-right')
    lastX=x
    ghost.style.left=x+'px'
    ghost.style.top=y+'px'
    setTimeout(wander,delay)
  }
  setTimeout(wander,900)
})()
