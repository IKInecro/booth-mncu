// ponytail: ultra minimal — plain JS, no build, no import, python3 -m http.server ready
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
const overlay=$('#frame-overlay')
const countdownEl=$('#countdown')
const flashEl=$('#flash')
const progressEl=$('#progress')
const thumbsEl=$('#thumbs')
const boothHint=$('#booth-hint')
const btnCapture=$('#btn-capture')
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
      msg.textContent='Butuh HTTPS atau localhost untuk kamera. Pakai python di localhost sudah aman.'
    }else{
      msg.textContent='Gagal buka kamera: '+(e.message||name)
    }
    $('#btn-allow').textContent='Coba Lagi →'
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
  renderProgress()
  renderThumbs()
  overlay.src = f.src
  show('booth')
  startCamera()
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
  progressEl.innerHTML=''
  for(let i=0;i<n;i++){
    const d=document.createElement('div')
    d.className='dot'+(i<photosCanvases.length?' done':'')+(i===photosCanvases.length?' active':'')
    progressEl.appendChild(d)
  }
  boothHint.textContent = photosCanvases.length>=n ? 'Strip penuh — lihat hasil' : `Foto ${photosCanvases.length+1} dari ${n} — pose dulu!`
  btnCapture.disabled = photosCanvases.length>=n
  btnCapture.textContent = photosCanvases.length>=n ? 'Selesai ✓' : '📸 Ambil Foto'
  $('#btn-retake').hidden = photosCanvases.length===0
}
function renderThumbs(){
  thumbsEl.innerHTML=''
  photosCanvases.forEach((c)=>{
    const img=document.createElement('img')
    img.src=c.toDataURL('image/jpeg',0.85)
    thumbsEl.appendChild(img)
  })
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
  countdownEl.textContent='📸'
  await sleep(280)
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
  renderProgress(); renderThumbs()
  btnCapture.disabled=false
  if(photosCanvases.length>=selected.slots.length){
    await sleep(420)
    await composeAndShow()
  }
}
$('#btn-retake').onclick=()=>{
  photosCanvases.pop()
  renderProgress(); renderThumbs()
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
  renderProgress(); renderThumbs()
  overlay.src=selected?.src||''
  show('booth')
  startCamera()
}
loadFrames()
show('gate')
