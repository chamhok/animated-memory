(async()=>{
try{
const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js');
const coarse=matchMedia('(pointer:coarse)').matches;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b14);scene.fog=new THREE.Fog(0x070b14,18,58);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,100);camera.position.set(0,1.7,8);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.querySelector('#game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x8acfff,0x111322,1.25));const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(8,13,7);sun.castShadow=true;scene.add(sun);
const mat=(c,e=0)=>new THREE.MeshStandardMaterial({color:c,emissive:e,roughness:.62,metalness:.25});
const floorMat=mat(0x182033),wallMat=mat(0x202b43),cyanMat=mat(0x2d6170,0x0d3541),redMat=mat(0x6b1f2d,0x3b0710),greenMat=mat(0x245f4a,0x08291e);
function box(name,pos,size,material=wallMat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material.clone());m.name=name;m.position.set(...pos);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
box('floor',[0,-.25,-10],[12,.5,40],floorMat);box('left wall',[-6,2.5,-10],[.5,5.5,40]);box('right wall',[6,2.5,-10],[.5,5.5,40]);box('back wall',[0,2.5,10],[12,5.5,.5]);
for(let z=5;z>-29;z-=5){const strip=box('light strip',[0,.02,z],[11.4,.03,.07],cyanMat);strip.material.emissiveIntensity=2}
const interactables=[];function mark(o,type,label,extra={}){Object.assign(o.userData,{type,label,outline:null,active:true},extra);interactables.push(o);return o}
box('pit',[0,-.38,-3],[11.4,.25,5],mat(0x020306));
const hiddenBridge=[];for(let i=0;i<5;i++){const b=box('시간 발판',[0,-1.2,-1-i],[5.3,.35,.72],cyanMat);b.scale.y=.08;b.visible=false;mark(b,'bridge','시간 발판',{progress:0});hiddenBridge.push(b)}
const laserPivot=new THREE.Group();laserPivot.position.set(0,1.1,-10);scene.add(laserPivot);const laser=box('회전 레이저',[0,0,0],[10,.12,.12],redMat);scene.remove(laser);laserPivot.add(laser);mark(laser,'laser','회전 레이저',{frozen:0});box('laser base',[0,.5,-10],[1.3,1.3,1.3],redMat);
const stairs=[];for(let i=0;i<5;i++){const s=box('부서진 계단',[-2.8+i*1.4,-1.3+i*.38,-17-i*.15],[1.15,.35,2.1],greenMat);s.rotation.z=(i%2?1:-1)*.9;mark(s,'stairs','부서진 계단',{original:{p:new THREE.Vector3(-2.8+i*1.4,.05+i*.38,-17-i*.15),r:new THREE.Euler(0,0,0)},rewind:0});stairs.push(s)}
const door=box('exit door',[0,1.65,-23],[4,3.8,.35],mat(0x26283f,0x080914));door.userData.open=0;box('door frame',[-2.35,1.65,-23],[.5,4.3,.7],cyanMat);box('door frame',[2.35,1.65,-23],[.5,4.3,.7],cyanMat);
const goal=new THREE.Mesh(new THREE.BoxGeometry(3.5,3.2,.3),new THREE.MeshBasicMaterial({color:0x63e6ff,transparent:true,opacity:.13}));goal.position.set(0,1.5,-25);scene.add(goal);
const player={yaw:Math.PI,pitch:0};const keys={};let started=false,mode='scan',energy=100,selected=null,bridgeDone=false,laserDone=false,stairsDone=false;
const ray=new THREE.Raycaster();const targetEl=document.querySelector('#target'),hint=document.querySelector('#hint'),objective=document.querySelector('#objective');let lastSelected=null;
function setMode(m){mode=m;document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));const text={scan:'스캔: 숨겨진 시간 흔적을 드러냅니다.',rewind:'되감기: 부서진 물체를 이전 상태로 복원합니다.',freeze:'정지: 움직이는 위험 요소의 시간을 멈춥니다.',accelerate:'3× 가속: 성장과 작동 시간을 빠르게 진행합니다.'};hint.textContent=text[m]}
document.querySelectorAll('.mode').forEach(b=>b.onclick=e=>{e.stopPropagation();setMode(b.dataset.mode)});
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Digit1')setMode('scan');if(e.code==='Digit2')setMode('rewind');if(e.code==='Digit3')setMode('freeze');if(e.code==='Digit4')setMode('accelerate')});addEventListener('keyup',e=>keys[e.code]=false);
renderer.domElement.addEventListener('click',()=>{if(!started)return;if(!coarse&&document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock();return}useAbility()});
addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement){player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.25,Math.min(1.25,player.pitch-e.movementY*.0022))}});
document.querySelector('#action').onclick=e=>{e.stopPropagation();useAbility()};
let joy={x:0,y:0,id:null},look={id:null,x:0,y:0};const joyEl=document.querySelector('#joystick'),stick=document.querySelector('#stick'),lookpad=document.querySelector('#lookpad');
function jmove(e){const r=joyEl.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.min(38,Math.hypot(x,y)),a=Math.atan2(y,x);joy.x=Math.cos(a)*l/38;joy.y=Math.sin(a)*l/38;stick.style.transform=`translate(${joy.x*38}px,${joy.y*38}px)`}
joyEl.onpointerdown=e=>{joy.id=e.pointerId;joyEl.setPointerCapture(e.pointerId);jmove(e)};joyEl.onpointermove=e=>{if(e.pointerId===joy.id)jmove(e)};joyEl.onpointerup=joyEl.onpointercancel=()=>{joy={x:0,y:0,id:null};stick.style.transform=''};
lookpad.onpointerdown=e=>{look={id:e.pointerId,x:e.clientX,y:e.clientY};lookpad.setPointerCapture(e.pointerId)};lookpad.onpointermove=e=>{if(e.pointerId!==look.id)return;player.yaw-=(e.clientX-look.x)*.006;player.pitch=Math.max(-1.25,Math.min(1.25,player.pitch-(e.clientY-look.y)*.006));look.x=e.clientX;look.y=e.clientY};lookpad.onpointerup=lookpad.onpointercancel=()=>look.id=null;
document.querySelector('#startBtn').onclick=()=>{started=true;document.querySelector('#start').style.display='none';if(!coarse)renderer.domElement.requestPointerLock()};
function spend(n){if(energy<n){hint.textContent='시간 에너지가 부족합니다. 잠시 기다리면 충전됩니다.';return false}energy-=n;return true}
function useAbility(){if(!started)return;if(mode==='scan'){if(!spend(3))return;hiddenBridge.forEach(b=>b.visible=true);hint.textContent='스캔 완료: 구덩이 아래 시간 발판을 조준하고 3× 가속을 세 번 사용하세요.';objective.textContent='숨은 발판을 3× 가속해 완전히 성장시키세요.';return}if(!selected){hint.textContent='조작할 물체를 중앙 조준점에 맞추세요.';return}const t=selected.userData.type;
 if(mode==='accelerate'&&t==='bridge'){if(!spend(10))return;hiddenBridge.forEach(b=>b.userData.progress=Math.min(1,b.userData.progress+.36));hint.textContent='발판의 시간을 3배 가속했습니다.'}
 else if(mode==='freeze'&&t==='laser'){if(!spend(20))return;laser.userData.frozen=8;hint.textContent='레이저 시간이 8초간 정지합니다. 지금 통과하세요.'}
 else if(mode==='rewind'&&t==='stairs'){if(!spend(12))return;stairs.forEach(s=>s.userData.rewind=Math.min(1,s.userData.rewind+.45));hint.textContent='계단의 파괴 시간을 되감았습니다.'}
 else hint.textContent='이 물체에는 다른 시간 기능이 필요합니다.';
}
function setHighlight(obj,on){if(!obj?.material?.emissive)return;const type=obj.userData.type;const base=type==='laser'?0x3b0710:type==='bridge'?0x0d3541:0x08291e;obj.material.emissive.setHex(on?0x176077:base);obj.material.emissiveIntensity=on?2.4:1}
function updateSelection(){ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(interactables,true).filter(h=>h.distance<10&&h.object.visible);selected=hits[0]?.object||null;if(lastSelected!==selected){setHighlight(lastSelected,false);setHighlight(selected,true);lastSelected=selected}if(selected&&selected.userData.label){targetEl.style.opacity=1;targetEl.textContent=selected.userData.label}else targetEl.style.opacity=0}
function updatePuzzle(dt){
 hiddenBridge.forEach(b=>{if(b.userData.progress>0){b.visible=true;b.scale.y=THREE.MathUtils.lerp(b.scale.y,Math.max(.08,b.userData.progress),dt*5);b.position.y=THREE.MathUtils.lerp(b.position.y,-.03,dt*4)}});bridgeDone=hiddenBridge.every(b=>b.userData.progress>=.95);
 if(laser.userData.frozen>0){laser.userData.frozen-=dt;laser.material.emissive.setHex(0x07152a);laser.material.emissiveIntensity=2.2}else{laserPivot.rotation.y+=dt*1.65;if(selected!==laser){laser.material.emissive.setHex(0x3b0710);laser.material.emissiveIntensity=1}}
 laserDone=camera.position.z<-13;
 stairs.forEach(s=>{if(s.userData.rewind>0){s.position.lerp(s.userData.original.p,dt*3.5);s.rotation.x=THREE.MathUtils.lerp(s.rotation.x,0,dt*4);s.rotation.y=THREE.MathUtils.lerp(s.rotation.y,0,dt*4);s.rotation.z=THREE.MathUtils.lerp(s.rotation.z,0,dt*4)}});stairsDone=stairs.every(s=>s.position.distanceTo(s.userData.original.p)<.12);
 if(bridgeDone&&!laserDone)objective.textContent='회전 레이저를 시간 정지시키고 통과하세요.';if(laserDone&&!stairsDone)objective.textContent='부서진 계단을 되감아 출구를 여세요.';if(stairsDone&&laserDone){door.userData.open=Math.min(1,door.userData.open+dt);door.position.y=1.65+door.userData.open*4;objective.textContent='출구가 열렸습니다. 앞으로 이동하세요.'}
 if(camera.position.z<-24.2&&stairsDone){started=false;document.exitPointerLock?.();document.querySelector('#win').style.display='grid'}
}
function collide(next){next.x=Math.max(-5.35,Math.min(5.35,next.x));next.z=Math.max(-27,Math.min(9,next.z));if(next.z>-5.5&&next.z<-.5&&!bridgeDone){const onBridge=Math.abs(next.x)<2.6&&hiddenBridge.some(b=>b.userData.progress>.8);if(!onBridge)next.z=camera.position.z}
 if(next.z<-8.5&&next.z>-11.5&&laser.userData.frozen<=0){const a=laserPivot.rotation.y,dx=next.x,dz=next.z+10,dist=Math.abs(dx*Math.sin(a)-dz*Math.cos(a));if(dist<.45&&Math.hypot(dx,dz)<5.2){next.set(0,1.7,1);hint.textContent='레이저에 닿았습니다. 시간 정지가 필요합니다.'}}
 if(next.z<-15&&next.z>-20&&!stairsDone)next.z=camera.position.z;return next}
function updatePlayer(dt){let x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x,y=(keys.KeyW?1:0)-(keys.KeyS?1:0)-joy.y;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len}const f=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw)),r=new THREE.Vector3(f.z,0,-f.x);const next=camera.position.clone().addScaledVector(f,y*dt*4.3).addScaledVector(r,x*dt*4.3);collide(next);camera.position.copy(next);camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0)}
let prev=performance.now();function loop(now){requestAnimationFrame(loop);const dt=Math.min(.033,(now-prev)/1000);prev=now;if(started){updatePlayer(dt);updateSelection();updatePuzzle(dt);energy=Math.min(100,energy+dt*4)}document.querySelector('#energyText').textContent=Math.floor(energy);document.querySelector('#energy i').style.width=energy+'%';renderer.render(scene,camera)}requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}catch(err){console.error(err);document.querySelector('#start').style.display='none';document.querySelector('#errorText').textContent='3D 엔진을 불러오지 못했습니다. 인터넷 연결과 WebGL 지원 여부를 확인해 주세요.';document.querySelector('#error').style.display='grid'}
})();
