"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HeroId = "ninja" | "operator" | "skeleton" | "granny";
type Hero = { id: HeroId; name: string; tag: string; color: string; accent: string; bio: string };

const HEROES: Hero[] = [
  { id: "ninja", name: "Kage", tag: "Shadow Ninja", color: "#171a25", accent: "#f04464", bio: "Last heir of the Silent Crane. Kage enters the ruins to recover the stolen blade that holds his clan's memories." },
  { id: "operator", name: "Rook", tag: "Special Ops", color: "#536348", accent: "#d5bb76", bio: "A rescue specialist left behind when the city fell. Rook has one final extraction to make—and refuses to leave anyone behind." },
  { id: "skeleton", name: "Cinder", tag: "Demon Bones", color: "#37223e", accent: "#ff7438", bio: "Summoned by the enemy, Cinder broke his infernal contract. Now he hunts the warlock who misplaced both his soul and his patience." },
  { id: "granny", name: "Mabel", tag: "Muumuu Mayhem", color: "#79528f", accent: "#ffcf5a", bio: "Retired librarian, undefeated bingo champion, and neighborhood protector. They ruined Mabel's garden. That was a tactical mistake." },
];

const WIDTH = 960;
const HEIGHT = 540;
const LEVEL_LENGTH = 3000;
const MUSIC_NAMES = ["beach","mountain","bunker","volcano"] as const;
const SFX_NAMES = ["fire","jump","impact","damage","enemy_down","cheer"] as const;
type AudioEngine = {ctx:AudioContext;musicGain:GainNode;sfxGain:GainNode;buffers:Map<string,AudioBuffer>;music:{source:AudioBufferSourceNode;gain:GainNode}|null};
const LEVELS = [
  { name:"Tidebreak Beach", sky:["#4a91bd","#f0c07a"], hazards:["driftwood","sandbags","rescueboard"] },
  { name:"Highland Village", sky:["#5b6e8b","#bd9370"], hazards:["stonewall","cart","woodpile"] },
  { name:"Blacksite Bunker", sky:["#18242a","#35443f"], hazards:["crate","barricade","generator"] },
  { name:"Caldera Zero", sky:["#2b0d18","#b93624"], hazards:["boulder","lavavent","beam"] },
] as const;
const LEVEL_END = LEVEL_LENGTH * LEVELS.length;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const keys = useRef<Record<string, boolean>>({});
  const audioRef = useRef<AudioEngine|null>(null);
  const audioLoadingRef = useRef<Promise<AudioEngine>|null>(null);
  const mutedRef = useRef(false);
  const musicVolumeRef = useRef(.45);
  const sfxVolumeRef = useRef(.7);
  const [hero, setHero] = useState<Hero>(HEROES[0]);
  const [mode, setMode] = useState<"select" | "playing" | "celebrate" | "won" | "lost">("select");
  const [campaignLevel, setCampaignLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(45);
  const [sfxVolume, setSfxVolume] = useState(70);
  const [isMobile, setIsMobile] = useState(false);

  const initAudio = useCallback(() => {if(audioRef.current)return Promise.resolve(audioRef.current);if(audioLoadingRef.current)return audioLoadingRef.current;const ctx=new AudioContext();const musicGain=ctx.createGain(),sfxGain=ctx.createGain();musicGain.connect(ctx.destination);sfxGain.connect(ctx.destination);musicGain.gain.value=mutedRef.current?0:musicVolumeRef.current;sfxGain.gain.value=mutedRef.current?0:sfxVolumeRef.current;void ctx.resume();const engine:AudioEngine={ctx,musicGain,sfxGain,buffers:new Map(),music:null};audioRef.current=engine;const loading=Promise.all([...MUSIC_NAMES.map(name=>[`music:${name}`,`audio/music/${name}.wav`] as const),...SFX_NAMES.map(name=>[`sfx:${name}`,`audio/sfx/${name}.wav`] as const)].map(async([key,path])=>{const response=await fetch(path);if(!response.ok)throw new Error(`Audio load failed: ${path}`);engine.buffers.set(key,await ctx.decodeAudioData(await response.arrayBuffer()));})).then(()=>engine);audioLoadingRef.current=loading;return loading;},[]);
  const playSfx = useCallback((name:string, rate=1) => {void initAudio().then(engine=>{void engine.ctx.resume();const buffer=engine.buffers.get(`sfx:${name}`);if(!buffer)return;const source=engine.ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;source.connect(engine.sfxGain);source.start();}).catch(()=>{});},[initAudio]);
  const transitionMusic = useCallback((level:number) => {void initAudio().then(engine=>{void engine.ctx.resume();const buffer=engine.buffers.get(`music:${MUSIC_NAMES[level]}`);if(!buffer)return;const now=engine.ctx.currentTime;engine.musicGain.gain.cancelScheduledValues(now);engine.musicGain.gain.setTargetAtTime(mutedRef.current?0:musicVolumeRef.current,now,.035);const incoming=engine.ctx.createBufferSource(),gain=engine.ctx.createGain();incoming.buffer=buffer;incoming.loop=true;incoming.loopStart=.75;incoming.loopEnd=buffer.duration;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.9);incoming.connect(gain).connect(engine.musicGain);incoming.start(now);const previous=engine.music;if(previous){previous.gain.gain.cancelScheduledValues(now);previous.gain.gain.setValueAtTime(previous.gain.gain.value,now);previous.gain.gain.linearRampToValueAtTime(0,now+.9);previous.source.stop(now+1);}engine.music={source:incoming,gain};}).catch(()=>{});},[initAudio]);
  const start = useCallback(() => {transitionMusic(0);playSfx("cheer",1.25);setCampaignLevel(0);setMode("playing");}, [playSfx,transitionMusic]);
  const advanceLevel = useCallback(() => {if(campaignLevel>=LEVELS.length-1){const audio=audioRef.current;if(audio){const now=audio.ctx.currentTime;audio.musicGain.gain.linearRampToValueAtTime(0,now+.8);}setMode("won");}else{transitionMusic(campaignLevel+1);setCampaignLevel(level=>level+1);setMode("playing");}},[campaignLevel,transitionMusic]);

  useEffect(()=>{mutedRef.current=muted;musicVolumeRef.current=musicVolume/100;sfxVolumeRef.current=sfxVolume/100;const audio=audioRef.current;if(audio){const now=audio.ctx.currentTime;audio.musicGain.gain.cancelScheduledValues(now);audio.sfxGain.gain.cancelScheduledValues(now);audio.musicGain.gain.setTargetAtTime(muted?0:musicVolume/100,now,.035);audio.sfxGain.gain.setTargetAtTime(muted?0:sfxVolume/100,now,.035);}},[muted,musicVolume,sfxVolume]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current[event.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => { keys.current[event.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const detectMobile = () => setIsMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 820);
    detectMobile();
    window.addEventListener("resize", detectMobile);
    return () => window.removeEventListener("resize", detectMobile);
  }, []);

  const touchKey = (code: string, pressed: boolean) => { keys.current[code] = pressed; };

  useEffect(() => {
    if (mode !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = {
      player: { x: campaignLevel*LEVEL_LENGTH+140, y: 415, depth:475, vy: 0, hp: 100, grounded: true, jumpsLeft: 2, cooldown: 0, invuln: 0, facing: 1, walkPhase: 0 },
      jumpHeld: false,
      camera: campaignLevel*LEVEL_LENGTH,
      score: 0,
      distance: 0,
      bullets: [] as { x: number; y: number; vx: number; enemy?: boolean }[],
      particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
      obstacles: Array.from({ length: 32 }, (_, i) => {
        const level=Math.floor(i/8);const local=i%8;const kind=LEVELS[level].hazards[local%LEVELS[level].hazards.length];
        const sizes:Record<string,[number,number]>={driftwood:[86,48],sandbags:[82,53],rescueboard:[52,88],stonewall:[82,61],cart:[88,68],woodpile:[84,58],crate:[68,64],barricade:[88,61],generator:[78,69],boulder:[76,67],lavavent:[72,64],beam:[88,52]};
        return {x:level*LEVEL_LENGTH+500+local*310+(local%2)*20,kind,w:sizes[kind][0],h:sizes[kind][1],depth:420+(local%3)*55};
      }),
      enemies: Array.from({ length: 43 }, (_, i) => {const level=Math.min(3,Math.floor((600+i*270)/LEVEL_LENGTH));const depth=420+(i%3)*55;return {x:600+i*270,y:depth-43,depth,hp:1+level+(i%7===6?1:0),cooldown:55+(i*17)%70,alive:true,facing:-1,variant:[0,1,2,3][i%4],squad:Math.floor(i/3),moving:false,walkPhase:i};}),
    };

    const heroSprites=HEROES.map(item=>{const image=new Image();image.src=`sprites/heroes/${item.id}.png`;return image;});
    const enemySprites=["mercenary","trooper","officer","heavy"].map(name=>{const image=new Image();image.src=`sprites/enemies/${name}.png`;return image;});
    const levelAtlas=new Image();let levelAtlasReady=false;levelAtlas.onload=()=>{levelAtlasReady=true};levelAtlas.src="backgrounds/level-atlas-v2.png";
    const obstacleAtlas=new Image();let obstacleAtlasReady=false;obstacleAtlas.onload=()=>{obstacleAtlasReady=true};obstacleAtlas.src="sprites/obstacle-atlas.png";
    const sfx=(name:string,rate=1)=>playSfx(name,rate);
    const cheer=()=>playSfx("cheer");

    const burst = (x: number, y: number, color: string, amount = 8) => {
      for (let i = 0; i < amount; i++) state.particles.push({ x, y, vx: Math.random() * 5 - 2.5, vy: Math.random() * -4, life: 24, color });
    };
    const rectHit = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

    const drawHero = (x: number, y: number, facing: number, walkPhase: number) => {
      ctx.save();ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(x+20,y+61,28,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
      const sprite=heroSprites[HEROES.findIndex(h=>h.id===hero.id)];if(sprite.complete&&sprite.naturalWidth){const moving=Boolean(keys.current.KeyA||keys.current.KeyD||keys.current.KeyW||keys.current.KeyS||keys.current.ArrowLeft||keys.current.ArrowRight||keys.current.ArrowUp||keys.current.ArrowDown);const step=moving?Math.sin(walkPhase):0;const bob=moving?(1-Math.cos(walkPhase*2))*1.5:0;const lean=moving?Math.sin(walkPhase)*.018:0;ctx.save();ctx.translate(x+(facing<0?44:0)+20,y+8-bob);ctx.rotate(lean);ctx.transform(1,step*.018,-step*.025,1,0,0);ctx.scale(facing*(1+Math.abs(step)*.012),1-Math.abs(step)*.01);ctx.drawImage(sprite,-41,-55,94,108);ctx.restore();return;}
      ctx.save(); ctx.translate(x+(facing<0?42:0), y); ctx.scale(facing,1);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(18, 45, 25, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = hero.color; ctx.fillRect(7, 4, 24, 32);
      ctx.fillStyle = hero.accent;
      if (hero.id === "ninja") { ctx.fillRect(3, 0, 32, 11); ctx.fillRect(29, 7, 22, 4); ctx.fillStyle="#d7d9df";ctx.fillRect(13,8,15,3);ctx.fillStyle=hero.accent;ctx.fillRect(5,28,30,4); }
      if (hero.id === "operator") { ctx.fillRect(5, -3, 28, 9); ctx.fillStyle="#1a211a"; ctx.fillRect(7, 14, 24, 15);ctx.fillStyle="#78866b";ctx.fillRect(3,17,7,13);ctx.fillRect(29,17,7,13);ctx.fillStyle="#78b5a0";ctx.fillRect(12,3,15,3); }
      if (hero.id === "skeleton") { ctx.beginPath(); ctx.arc(19, 5, 12, 0, Math.PI*2); ctx.fill(); ctx.fillStyle="#241627"; ctx.fillRect(12, 2, 4, 5); ctx.fillRect(23, 2, 4, 5);ctx.fillStyle="#fff0d0";ctx.fillRect(13,15,3,17);ctx.fillRect(19,15,3,17);ctx.fillRect(25,15,3,17);ctx.fillStyle=hero.accent;ctx.fillRect(4,-3,4,9);ctx.fillRect(30,-3,4,9); }
      if (hero.id === "granny") { ctx.beginPath(); ctx.moveTo(19, 8); ctx.lineTo(39, 38); ctx.lineTo(-1, 38); ctx.closePath(); ctx.fill(); ctx.fillStyle="#e8b58c"; ctx.beginPath(); ctx.arc(19, 2, 11, 0, Math.PI*2); ctx.fill();ctx.fillStyle="#e9e5dc";ctx.beginPath();ctx.arc(16,-5,9,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f8dc69";ctx.fillRect(4,23,4,4);ctx.fillRect(17,29,4,4);ctx.fillRect(30,22,4,4); }
      ctx.fillStyle="#252632"; ctx.fillRect(10, 36, 7, 10); ctx.fillRect(25, 36, 7, 10);
      ctx.fillStyle="#929ba8"; ctx.fillRect(28, 16, 27, 8);ctx.fillStyle="#252a32";ctx.fillRect(34,22,7,5);ctx.fillRect(44,13,8,4); ctx.fillStyle="#ffcf5a"; ctx.fillRect(54, 18, 7, 4);
      ctx.restore();
    };

    const drawObstacle = (o: typeof state.obstacles[number], x: number) => {
      const y=o.depth-o.h;ctx.save();ctx.translate(x,y);ctx.lineWidth=3;
      const order=["driftwood","sandbags","rescueboard","stonewall","cart","woodpile","crate","barricade","generator","boulder","lavavent","beam"];
      const spriteIndex=order.indexOf(o.kind);if(obstacleAtlasReady&&spriteIndex>=0){const cellW=obstacleAtlas.width/3;const cellH=obstacleAtlas.height/4;ctx.drawImage(obstacleAtlas,(spriteIndex%3)*cellW,Math.floor(spriteIndex/3)*cellH,cellW,cellH,0,0,o.w,o.h);ctx.restore();return;}
      if(o.kind==="driftwood"){ctx.strokeStyle="#6f4b33";ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(2,25);ctx.lineTo(74,12);ctx.stroke();ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(20,20);ctx.lineTo(10,2);ctx.moveTo(48,17);ctx.lineTo(58,1);ctx.stroke();}
      if(o.kind==="sandbags"){ctx.fillStyle="#a8956b";for(let row=0;row<2;row++)for(let col=0;col<3-row;col++){ctx.beginPath();ctx.ellipse(13+col*23+row*11,34-row*20,14,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#645943";ctx.stroke();}}
      if(o.kind==="stonewall"){ctx.fillStyle="#77746d";ctx.fillRect(0,8,74,50);ctx.strokeStyle="#474641";for(let yy=10;yy<58;yy+=16){ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(74,yy);ctx.stroke();for(let xx=(yy%32?18:35);xx<74;xx+=36){ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx,yy+16);ctx.stroke();}}}
      if(o.kind==="cart"){ctx.fillStyle="#79533b";ctx.fillRect(2,5,72,32);ctx.strokeStyle="#b58a58";ctx.strokeRect(2,5,72,32);ctx.fillStyle="#292a2b";ctx.beginPath();ctx.arc(17,45,10,0,Math.PI*2);ctx.arc(61,45,10,0,Math.PI*2);ctx.fill();}
      if(o.kind==="woodpile"){ctx.fillStyle="#6f482e";for(let row=0;row<3;row++)for(let col=0;col<3;col++){ctx.fillRect(col*23+2,row*14+7,38,10);ctx.fillStyle="#a87543";ctx.beginPath();ctx.arc(col*23+37,row*14+12,5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#6f482e";}}
      if(o.kind==="crate"){ctx.fillStyle="#7d765e";ctx.fillRect(0,0,58,58);ctx.strokeStyle="#b0a77e";ctx.strokeRect(4,4,50,50);ctx.beginPath();ctx.moveTo(5,5);ctx.lineTo(53,53);ctx.moveTo(53,5);ctx.lineTo(5,53);ctx.stroke();}
      if(o.kind==="barricade"){ctx.fillStyle="#c4c5bd";ctx.fillRect(0,8,82,13);ctx.fillRect(0,30,82,13);ctx.fillStyle="#e1a536";for(let i=0;i<4;i++){ctx.save();ctx.translate(i*24,0);ctx.rotate(-.5);ctx.fillRect(8,0,8,50);ctx.restore();}}
      if(o.kind==="generator"){ctx.fillStyle="#39494b";ctx.fillRect(3,8,66,49);ctx.strokeStyle="#6e8483";ctx.strokeRect(0,0,72,62);ctx.fillStyle="#161d20";ctx.beginPath();ctx.arc(24,32,14,0,Math.PI*2);ctx.fill();ctx.fillStyle="#d6aa3d";ctx.fillRect(48,17,12,8);}
      if(o.kind==="boulder"){ctx.fillStyle="#3f3838";ctx.beginPath();ctx.moveTo(0,58);ctx.lineTo(8,19);ctx.lineTo(28,2);ctx.lineTo(57,12);ctx.lineTo(68,58);ctx.closePath();ctx.fill();ctx.strokeStyle="#655152";ctx.stroke();}
      if(o.kind==="lavavent"){ctx.fillStyle="#3b3031";ctx.beginPath();ctx.moveTo(0,46);ctx.lineTo(14,18);ctx.lineTo(48,15);ctx.lineTo(62,46);ctx.closePath();ctx.fill();ctx.fillStyle="#ff6a24";ctx.beginPath();ctx.moveTo(18,18);ctx.lineTo(31,0);ctx.lineTo(45,18);ctx.closePath();ctx.fill();ctx.fillStyle="#ffd052";ctx.fillRect(27,8,9,17);}
      if(o.kind==="beam"){ctx.fillStyle="#423537";ctx.save();ctx.translate(0,24);ctx.rotate(-.17);ctx.fillRect(0,0,82,15);ctx.fillStyle="#e75b29";for(let i=8;i<78;i+=22)ctx.fillRect(i,2,10,11);ctx.restore();}
      ctx.restore();
    };

    const draw = () => {
      const levelIndex=campaignLevel;const level=LEVELS[levelIndex];
      const sky = ctx.createLinearGradient(0,0,0,HEIGHT); sky.addColorStop(0,level.sky[0]); sky.addColorStop(1,level.sky[1]); ctx.fillStyle=sky; ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle=levelIndex===3?"#ff4a27":"#f6d58a"; ctx.beginPath(); ctx.arc(760,levelIndex===2?70:120,levelIndex===3?70:48,0,Math.PI*2); ctx.fill();
      for (let layer=0; layer<3; layer++) { ctx.fillStyle=levelIndex===0?["#7db5bd","#4f8f9c","#315f6d"][layer]:levelIndex===2?["#2f4242","#263535","#1b292b"][layer]:levelIndex===3?["#5a2025","#401820","#2b121a"][layer]:["#667082","#465268","#2d374b"][layer]; ctx.beginPath(); ctx.moveTo(0,360); for(let x=0;x<=WIDTH;x+=120){ const wx=x+state.camera*(.08+layer*.05); ctx.lineTo(x,(levelIndex===0?335:250)+layer*(levelIndex===0?22:45)+Math.sin(wx*.009)*(levelIndex===0?12:40)); } ctx.lineTo(WIDTH,460); ctx.lineTo(0,460); ctx.fill(); }
      for(let layer=0;layer<2;layer++){const step=layer?118:145;const parallax=layer ? .38 : .24;const shift=-(state.camera*parallax%step);for(let i=-1;i<Math.ceil(WIDTH/step)+1;i++){const n=Math.abs(i+Math.floor(state.camera*parallax/step));const w=65+(n*37%58);const h=85+(n*61%145);const x=shift+i*step;const y=450-h;ctx.fillStyle=layer?"#111723":"#20283c";ctx.fillRect(x,y,w,h);if(n%4===0){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y-28);ctx.lineTo(x+w,y);ctx.fill();}if(n%4===1){ctx.fillRect(x+w*.45,y-24,4,24);ctx.fillRect(x+w*.35,y-24,w*.24,4);}ctx.fillStyle=layer?"#d55b43":"#5f6072";for(let wx=x+13;wx<x+w-8;wx+=22)for(let wy=y+20;wy<435;wy+=29)ctx.fillRect(wx,wy,8,9);}}
      if(levelAtlasReady){const panelW=levelAtlas.width/2;const panelH=levelAtlas.height/2;ctx.drawImage(levelAtlas,(levelIndex%2)*panelW,Math.floor(levelIndex/2)*panelH,panelW,panelH,0,0,WIDTH,HEIGHT);ctx.fillStyle="rgba(8,12,18,.04)";ctx.fillRect(0,390,WIDTH,150);}
      const time=performance.now()/1000;
      if(levelIndex===0){ctx.strokeStyle="rgba(225,250,255,.62)";ctx.lineWidth=2.5;for(let wave=0;wave<3;wave++){ctx.beginPath();for(let x=0;x<=WIDTH;x+=12){const y=318+wave*11+Math.sin(x*.032+time*1.8+wave)*3+Math.sin(x*.011-time)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.strokeStyle="rgba(23,44,66,.85)";ctx.lineWidth=1.7;for(let bird=0;bird<4;bird++){const bx=(time*27+bird*245)%1100-70,by=72+bird*25,wing=5+Math.sin(time*7+bird)*3;ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+7,by-wing,bx+14,by);ctx.quadraticCurveTo(bx+21,by-wing,bx+28,by);ctx.stroke();}ctx.fillStyle="rgba(255,255,255,.28)";for(let cloud=0;cloud<2;cloud++){const cx=(time*11+cloud*560)%1160-100,cy=58+cloud*62;ctx.beginPath();ctx.ellipse(cx,cy,60,13,0,0,Math.PI*2);ctx.ellipse(cx+28,cy-8,31,18,0,0,Math.PI*2);ctx.ellipse(cx-25,cy-5,28,15,0,0,Math.PI*2);ctx.fill();}}
      if(levelIndex===1){ctx.fillStyle="rgba(255,255,255,.22)";for(let cloud=0;cloud<3;cloud++){const cx=(time*(7+cloud)+cloud*390)%1180-110,cy=64+cloud*48;ctx.beginPath();ctx.ellipse(cx,cy,68,14,0,0,Math.PI*2);ctx.ellipse(cx+31,cy-8,34,18,0,0,Math.PI*2);ctx.ellipse(cx-29,cy-5,30,15,0,0,Math.PI*2);ctx.fill();}}
      if(levelIndex===2){const blink=(Math.sin(time*5)+1)/2;const glow=ctx.createRadialGradient(145,102,2,145,102,30);glow.addColorStop(0,`rgba(255,80,55,${.65+blink*.3})`);glow.addColorStop(1,"rgba(255,35,25,0)");ctx.fillStyle=glow;ctx.fillRect(112,69,66,66);ctx.strokeStyle="rgba(176,199,202,.72)";ctx.lineWidth=3;ctx.save();ctx.translate(820,112);ctx.rotate(time*2.7);for(let spoke=0;spoke<5;spoke++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(27,0);ctx.stroke();}ctx.restore();}
      if(levelIndex===3){const lavaGlow=ctx.createRadialGradient(500,425,20,500,425,300);lavaGlow.addColorStop(0,`rgba(255,80,30,${.05+(Math.sin(time*2)+1)*.035})`);lavaGlow.addColorStop(1,"rgba(255,50,20,0)");ctx.fillStyle=lavaGlow;ctx.fillRect(180,180,640,350);for(let ember=0;ember<24;ember++){const ex=(ember*71+time*(12+ember%4))%WIDTH,ey=500-((time*(32+ember%5)+ember*29)%320),size=2+(ember%3);ctx.fillStyle=ember%2?"#ffbd52":"#ff5a2d";ctx.globalAlpha=.28+(ember%5)*.1;ctx.beginPath();ctx.arc(ex+Math.sin(time*2+ember)*8,ey,size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
      const groundShade=ctx.createLinearGradient(0,400,0,HEIGHT);groundShade.addColorStop(0,"rgba(5,9,14,0)");groundShade.addColorStop(1,"rgba(5,9,14,.12)");ctx.fillStyle=groundShade;ctx.fillRect(0,400,WIDTH,HEIGHT-400);
      const boundaryY=407;ctx.save();
      if(levelIndex===0){ctx.strokeStyle="rgba(117,91,55,.34)";ctx.lineWidth=7;ctx.beginPath();for(let x=-20;x<=WIDTH+20;x+=14){const y=boundaryY+Math.sin(x*.026+time*1.4)*2;x<0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();ctx.strokeStyle="rgba(250,241,205,.9)";ctx.lineWidth=3;ctx.stroke();for(let x=40;x<WIDTH;x+=150){ctx.fillStyle="rgba(93,67,40,.56)";ctx.beginPath();ctx.ellipse(x-(state.camera*.05%150),boundaryY+7,5,2.5,.3,0,Math.PI*2);ctx.fill();}}
      if(levelIndex===1){for(let x=-36;x<WIDTH+40;x+=42){const offset=-(state.camera*.035%42);ctx.fillStyle=x%84?"rgba(82,76,69,.9)":"rgba(112,103,91,.9)";ctx.beginPath();ctx.roundRect(x+offset,boundaryY-5,39,12,5);ctx.fill();ctx.strokeStyle="rgba(194,183,161,.42)";ctx.lineWidth=1.5;ctx.stroke();}}
      if(levelIndex===2){ctx.fillStyle="rgba(17,24,27,.92)";ctx.fillRect(0,boundaryY-6,WIDTH,13);ctx.strokeStyle="rgba(119,137,140,.75)";ctx.lineWidth=2;ctx.strokeRect(-2,boundaryY-7,WIDTH+4,15);for(let x=-(state.camera*.12%48)-24;x<WIDTH+24;x+=48){ctx.fillStyle="#b89132";ctx.beginPath();ctx.moveTo(x,boundaryY-5);ctx.lineTo(x+17,boundaryY-5);ctx.lineTo(x+29,boundaryY+5);ctx.lineTo(x+12,boundaryY+5);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(190,204,204,.65)";ctx.beginPath();ctx.arc(x+38,boundaryY,2,0,Math.PI*2);ctx.fill();}}
      if(levelIndex===3){ctx.shadowColor="#ff572b";ctx.shadowBlur=10;ctx.strokeStyle="rgba(255,91,39,.86)";ctx.lineWidth=3;ctx.beginPath();for(let x=-20;x<=WIDTH+20;x+=22){const y=boundaryY+Math.sin(x*.05+time*.7)*3+Math.sin(x*.017)*2;x<0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle="rgba(36,20,22,.85)";ctx.lineWidth=1;ctx.stroke();}
      ctx.restore();
      for(const o of state.obstacles){const x=o.x-state.camera;if(x>-100&&x<WIDTH+100)drawObstacle(o,x);}
      for(const e of state.enemies){if(!e.alive)continue;const x=e.x-state.camera;if(x>-80&&x<WIDTH+80){ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(x+18,e.depth+3,25,7,0,0,Math.PI*2);ctx.fill();const sprite=enemySprites[e.variant];if(sprite.complete&&sprite.naturalWidth){const step=e.moving?Math.sin(e.walkPhase):0;const bob=e.moving?(1-Math.cos(e.walkPhase*2))*1.5:0;ctx.save();ctx.translate(x+(e.facing<0?38:0)+18,e.y+3-bob);ctx.rotate(step*.016);ctx.transform(1,step*.018,-step*.025,1,0,0);ctx.scale(e.facing*(1+Math.abs(step)*.012),1-Math.abs(step)*.01);ctx.drawImage(sprite,-36,-44,82,88);ctx.restore();}else{ctx.save();ctx.translate(x+(e.facing<0?34:0),e.y);ctx.scale(e.facing,1);ctx.fillStyle="#351e29";ctx.fillRect(0,0,34,43);ctx.fillStyle="#8cffcf";ctx.fillRect(5,8,7,4);ctx.fillRect(22,8,7,4);ctx.fillStyle="#bf4859";ctx.fillRect(28,19,21,7);ctx.restore();}}}
      for(const b of state.bullets){ctx.fillStyle=b.enemy?"#ff5973":"#ffd15b";ctx.fillRect(b.x-state.camera,b.y,b.enemy?9:14,4);}
      for(const p of state.particles){ctx.globalAlpha=p.life/24;ctx.fillStyle=p.color;ctx.fillRect(p.x-state.camera,p.y,4,4);}ctx.globalAlpha=1;
      drawHero(state.player.x-state.camera,state.player.y,state.player.facing,state.player.walkPhase);
      ctx.fillStyle="rgba(9,13,24,.82)";ctx.fillRect(24,22,300,72);ctx.fillStyle="#f4efe3";ctx.font="700 15px Arial";ctx.fillText(hero.name.toUpperCase(),42,48);ctx.fillStyle="#2b343e";ctx.fillRect(42,59,150,12);ctx.fillStyle=state.player.hp>35?"#67e6a4":"#f15d67";ctx.fillRect(42,59,150*Math.max(0,state.player.hp)/100,12);ctx.fillStyle="#f4efe3";ctx.fillText(`${state.score.toString().padStart(5,"0")} PTS`,214,69);
      ctx.fillStyle="#2b343e";ctx.fillRect(350,34,410,12);ctx.fillStyle=hero.accent;ctx.fillRect(350,34,410*Math.min(1,state.distance/(LEVEL_LENGTH-310)),12);ctx.fillStyle="#dce2e7";ctx.font="700 12px Arial";ctx.fillText(`LEVEL ${levelIndex+1}: ${level.name.toUpperCase()}`,350,66);ctx.fillText("LEVEL EXIT",780,45);
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1.7,(now-last)/16.67); last=now;
      const p=state.player; const k=keys.current;
      const speed=(k.ShiftLeft||k.ShiftRight)?7:5;
      if(k.KeyD||k.ArrowRight){p.x+=speed*dt;p.facing=1;}if(k.KeyA||k.ArrowLeft){p.x-=speed*dt;p.facing=-1;}
      if(k.KeyW||k.ArrowUp)p.depth=Math.max(410,p.depth-3.5*dt);if(k.KeyS||k.ArrowDown)p.depth=Math.min(535,p.depth+3.5*dt);if(p.grounded)p.y=p.depth-60;
      if(p.grounded&&(k.KeyA||k.KeyD||k.KeyW||k.KeyS||k.ArrowLeft||k.ArrowRight||k.ArrowUp||k.ArrowDown))p.walkPhase+=dt*.34;
      const levelStart=campaignLevel*LEVEL_LENGTH;const levelFinish=(campaignLevel+1)*LEVEL_LENGTH;
      p.x=Math.max(levelStart+30,p.x);state.distance=Math.max(state.distance,p.x-levelStart-140);
      const jumpPressed = Boolean(k.Space);
      if(jumpPressed&&!state.jumpHeld&&p.jumpsLeft>0){p.vy=-13.5;p.grounded=false;p.jumpsLeft--;burst(p.x+20,p.y+44,hero.accent,5);sfx("jump",p.jumpsLeft?1:1.25);}
      state.jumpHeld=jumpPressed;
      p.vy+=.7*dt;p.y+=p.vy*dt;if(p.y>=p.depth-60){p.y=p.depth-60;p.vy=0;p.grounded=true;p.jumpsLeft=2;}
      p.cooldown-=dt;p.invuln-=dt;if((k.KeyF||k.KeyJ||k.ControlLeft)&&p.cooldown<=0){state.bullets.push({x:p.x+(p.facing>0?58:-18),y:p.y-8,vx:15*p.facing});p.cooldown=10;sfx("fire",hero.id==="granny"?.78:1);}
      state.camera=Math.max(levelStart,Math.min(levelFinish-WIDTH,p.x-260));
      for(const o of state.obstacles){const box={x:o.x,y:o.depth-o.h,w:o.w,h:o.h};if(rectHit({x:p.x,y:p.y,w:40,h:58},box)&&p.invuln<=0){p.hp-=14;p.invuln=45;p.x-=35;burst(p.x,p.y+25,"#ff6579");sfx("damage",.85);}}
      for(const e of state.enemies){if(!e.alive)continue;const danger=Math.min(3,Math.floor(e.x/LEVEL_LENGTH));const dx=p.x-e.x;e.facing=dx<0?-1:1;e.cooldown-=dt;e.moving=false;if(Math.abs(dx)<720){const groupRush=(Math.floor(now/2800)+e.squad)%4===0;const desiredGap=groupRush?80+(e.squad%3)*24:170+(e.squad%2)*55;let moveX=0;if(Math.abs(dx)>desiredGap)moveX=Math.sign(dx);else if(Math.abs(dx)<90)moveX=-Math.sign(dx);if(moveX){e.x+=moveX*(.7+danger*.13)*dt;e.moving=true;}const depthTarget=Math.max(410,Math.min(535,p.depth+((e.squad%3)-1)*18));const depthDelta=depthTarget-e.depth;if(Math.abs(depthDelta)>3){e.depth+=Math.sign(depthDelta)*(.48+danger*.06)*dt;e.moving=true;}if(e.moving)e.walkPhase+=dt*.3;e.x=Math.max(levelStart+70,Math.min(levelFinish-185,e.x));e.depth=Math.max(410,Math.min(535,e.depth));e.y=e.depth-43;}if(Math.abs(e.x-p.x)<520&&Math.abs(e.depth-p.depth)<42&&e.cooldown<=0){state.bullets.push({x:e.x+(e.facing>0?55:-18),y:e.y-7,vx:(7+danger*1.4)*e.facing,enemy:true});e.cooldown=100-danger*16+Math.random()*40;sfx("fire",.72+danger*.06);}}
      for(const b of state.bullets)b.x+=b.vx*dt;
      for(const b of state.bullets){if(b.enemy&&rectHit({x:b.x,y:b.y,w:9,h:7},{x:p.x-8,y:p.y-25,w:58,h:84})&&p.invuln<=0){p.hp-=10;p.invuln=35;b.x=-999;burst(p.x,p.y+20,"#ff6579");sfx("damage");}if(!b.enemy)for(const e of state.enemies){if(e.alive&&rectHit({x:b.x,y:b.y,w:16,h:8},{x:e.x-12,y:e.y-32,w:62,h:78})){e.hp--;b.x=99999;burst(e.x,e.y+12,"#ffb13b");sfx("impact");if(e.hp<=0){e.alive=false;state.score+=100;sfx("enemy_down");}}}}
      state.bullets=state.bullets.filter(b=>b.x>state.camera-100&&b.x<state.camera+WIDTH+150);
      for(const q of state.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.2;q.life--;}state.particles=state.particles.filter(q=>q.life>0);
      if(p.hp<=0){setMode("lost");return;}if(p.x>=levelFinish-170){cheer();setMode("celebrate");return;}
      draw();frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(frameRef.current);
  },[hero,mode,campaignLevel,playSfx]);

  return <main className="game-shell">
    <header><div className="brand"><span>R<span>&</span>G</span><div>RUN &amp; GUN<small>LAST LIGHT</small></div></div><div className="audio-controls"><label>MUSIC <input aria-label="Music volume" type="range" min="0" max="100" value={musicVolume} onChange={event=>setMusicVolume(Number(event.target.value))}/></label><label>SFX <input aria-label="Sound effects volume" type="range" min="0" max="100" value={sfxVolume} onChange={event=>setSfxVolume(Number(event.target.value))}/></label><button className="sound" onClick={()=>setMuted(!muted)} aria-label="Toggle sound">{muted?"SOUND OFF":"SOUND ON"}</button></div></header>
    <section className="stage-wrap">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Side-scrolling shooter game" />
      {mode==="playing"&&isMobile&&<div className="mobile-controls" aria-label="Touch game controls">
        <div className="move-controls">
          <button aria-label="Move left" onPointerDown={e=>{e.preventDefault();touchKey("KeyA",true)}} onPointerUp={()=>touchKey("KeyA",false)} onPointerCancel={()=>touchKey("KeyA",false)} onPointerLeave={()=>touchKey("KeyA",false)}>◀</button>
          <span className="depth-controls"><button aria-label="Move toward background" onPointerDown={e=>{e.preventDefault();touchKey("KeyW",true)}} onPointerUp={()=>touchKey("KeyW",false)} onPointerCancel={()=>touchKey("KeyW",false)}>▲</button><button aria-label="Move toward foreground" onPointerDown={e=>{e.preventDefault();touchKey("KeyS",true)}} onPointerUp={()=>touchKey("KeyS",false)} onPointerCancel={()=>touchKey("KeyS",false)}>▼</button></span>
          <button aria-label="Move right" onPointerDown={e=>{e.preventDefault();touchKey("KeyD",true)}} onPointerUp={()=>touchKey("KeyD",false)} onPointerCancel={()=>touchKey("KeyD",false)} onPointerLeave={()=>touchKey("KeyD",false)}>▶</button>
        </div>
        <div className="action-controls">
          <button className="jump-control" aria-label="Jump or double jump" onPointerDown={e=>{e.preventDefault();touchKey("Space",true)}} onPointerUp={()=>touchKey("Space",false)} onPointerCancel={()=>touchKey("Space",false)}>JUMP</button>
          <button className="fire-control" aria-label="Fire weapon" onPointerDown={e=>{e.preventDefault();touchKey("KeyF",true)}} onPointerUp={()=>touchKey("KeyF",false)} onPointerCancel={()=>touchKey("KeyF",false)}>FIRE</button>
        </div>
      </div>}
      {mode==="select"&&<div className="overlay select"><p className="eyebrow">OPERATIVE SELECT</p><h1>Choose your chaos.</h1><p className="lede">Complete all four missions in order. Each exit unlocks the next combat zone.</p><div className="heroes">{HEROES.map(h=><button key={h.id} className={`hero-card ${hero.id===h.id?"active":""}`} onClick={()=>setHero(h)} style={{"--accent":h.accent} as React.CSSProperties}><span className="portrait anime"><img src={`sprites/heroes/${h.id}.png`} alt={`${h.name}, ${h.tag}`} /></span><strong>{h.name}</strong><small>{h.tag}</small><p>{h.bio}</p></button>)}</div><button className="deploy" onClick={start}>START LEVEL 1 <span>→</span></button></div>}
      {mode==="celebrate"&&<div className="overlay celebration"><img className="cheering-crowd" src="sprites/cheering-crowd.png" alt="A cheering crowd celebrating the hero" /><div className="victory-copy"><p className="eyebrow">LEVEL {campaignLevel+1} COMPLETE</p><h1>{LEVELS[campaignLevel].name} secured!</h1><p>The crowd surges forward, cheering {hero.name} on.</p><button className="deploy" onClick={advanceLevel}>{campaignLevel===LEVELS.length-1?"FINISH CAMPAIGN":"ENTER NEXT LEVEL"} <span>→</span></button></div></div>}
      {(mode==="won"||mode==="lost")&&<div className="overlay result"><p className="eyebrow">{mode==="won"?"MISSION COMPLETE":"OPERATIVE DOWN"}</p><h1>{mode==="won"?"Extraction secured.":"The city wins this round."}</h1><button className="deploy" onClick={start}>RUN IT AGAIN <span>↻</span></button><button className="change" onClick={()=>setMode("select")}>CHANGE OPERATIVE</button></div>}
    </section>
    <footer><div><kbd>A</kbd><kbd>D</kbd><span>LEFT / RIGHT</span></div><div><kbd>W</kbd><kbd>S</kbd><span>DEPTH</span></div><div><kbd>SPACE</kbd><span>DOUBLE JUMP</span></div><div><kbd>F</kbd><span>FIRE</span></div><p>Align your depth with enemies before firing.</p></footer>
  </main>;
}
