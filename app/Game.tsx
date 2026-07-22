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
const LEVEL_LENGTH = 2200;
const LEVELS = [
  { name:"Tidebreak Beach", sky:["#4a91bd","#f0c07a"], hazards:["driftwood","sandbags"] },
  { name:"Highland Village", sky:["#5b6e8b","#bd9370"], hazards:["stonewall","cart","woodpile"] },
  { name:"Blacksite Bunker", sky:["#18242a","#35443f"], hazards:["crate","barricade","generator"] },
  { name:"Caldera Zero", sky:["#2b0d18","#b93624"], hazards:["boulder","lavavent","beam"] },
] as const;
const LEVEL_END = LEVEL_LENGTH * LEVELS.length;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const keys = useRef<Record<string, boolean>>({});
  const audioRef = useRef<{ctx:AudioContext;master:GainNode;music:OscillatorNode}|null>(null);
  const [hero, setHero] = useState<Hero>(HEROES[0]);
  const [mode, setMode] = useState<"select" | "playing" | "won" | "lost">("select");
  const [muted, setMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const ensureAudio = useCallback(() => {
    if(audioRef.current){void audioRef.current.ctx.resume();return;}
    const ctx=new AudioContext();const master=ctx.createGain();master.gain.value=muted?0:.13;master.connect(ctx.destination);
    const music=ctx.createOscillator();const musicGain=ctx.createGain();music.type="triangle";music.frequency.value=55;musicGain.gain.value=.22;music.connect(musicGain).connect(master);music.start();
    audioRef.current={ctx,master,music};
  },[muted]);
  const start = useCallback(() => {ensureAudio();setMode("playing");}, [ensureAudio]);

  useEffect(()=>{if(audioRef.current)audioRef.current.master.gain.value=muted?0:.13;},[muted]);

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
      player: { x: 140, y: 390, vy: 0, hp: 100, grounded: true, jumpsLeft: 2, cooldown: 0, invuln: 0, facing: 1 },
      jumpHeld: false,
      camera: 0,
      score: 0,
      distance: 0,
      bullets: [] as { x: number; y: number; vx: number; enemy?: boolean }[],
      particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
      obstacles: Array.from({ length: 24 }, (_, i) => {
        const level=Math.floor(i/6);const local=i%6;const kind=LEVELS[level].hazards[local%LEVELS[level].hazards.length];
        const sizes:Record<string,[number,number]>={driftwood:[78,32],sandbags:[70,45],stonewall:[74,58],cart:[78,54],woodpile:[72,48],crate:[58,58],barricade:[82,50],generator:[72,64],boulder:[68,58],lavavent:[62,46],beam:[82,35]};
        return {x:level*LEVEL_LENGTH+500+local*285+(local%2)*35,kind,w:sizes[kind][0],h:sizes[kind][1]};
      }),
      enemies: Array.from({ length: 32 }, (_, i) => {const level=Math.min(3,Math.floor((700+i*270)/LEVEL_LENGTH));return {x:700+i*270,y:407,hp:1+level+(i%7===6?1:0),cooldown:55+(i*17)%70,alive:true,facing:-1,variant:i%4};}),
    };

    const animeAtlas=new Image();let atlasReady=false;animeAtlas.onload=()=>{atlasReady=true};animeAtlas.src="sprites/anime-atlas.png";
    const sfx=(frequency:number,duration=.07,type:OscillatorType="square")=>{const audio=audioRef.current;if(!audio)return;const osc=audio.ctx.createOscillator();const gain=audio.ctx.createGain();osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(.35,audio.ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.ctx.currentTime+duration);osc.connect(gain).connect(audio.master);osc.start();osc.stop(audio.ctx.currentTime+duration);};

    const burst = (x: number, y: number, color: string, amount = 8) => {
      for (let i = 0; i < amount; i++) state.particles.push({ x, y, vx: Math.random() * 5 - 2.5, vy: Math.random() * -4, life: 24, color });
    };
    const rectHit = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

    const drawHero = (x: number, y: number, facing: number) => {
      if(atlasReady){const index=HEROES.findIndex(h=>h.id===hero.id);const cellW=animeAtlas.width/4;const cellH=animeAtlas.height/2;ctx.save();ctx.translate(x+(facing<0?44:0),0);ctx.scale(facing,1);ctx.drawImage(animeAtlas,index*cellW,0,cellW,cellH,-21,y-47,94,108);ctx.restore();return;}
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
      const y=450-o.h;ctx.save();ctx.translate(x,y);ctx.lineWidth=3;
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
      const levelIndex=Math.min(3,Math.floor(state.player.x/LEVEL_LENGTH));const level=LEVELS[levelIndex];
      if(audioRef.current)audioRef.current.music.frequency.setTargetAtTime([110,82,55,41][levelIndex],audioRef.current.ctx.currentTime,.4);
      const sky = ctx.createLinearGradient(0,0,0,HEIGHT); sky.addColorStop(0,level.sky[0]); sky.addColorStop(1,level.sky[1]); ctx.fillStyle=sky; ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle=levelIndex===3?"#ff4a27":"#f6d58a"; ctx.beginPath(); ctx.arc(760,levelIndex===2?70:120,levelIndex===3?70:48,0,Math.PI*2); ctx.fill();
      for (let layer=0; layer<3; layer++) { ctx.fillStyle=levelIndex===0?["#7db5bd","#4f8f9c","#315f6d"][layer]:levelIndex===2?["#2f4242","#263535","#1b292b"][layer]:levelIndex===3?["#5a2025","#401820","#2b121a"][layer]:["#667082","#465268","#2d374b"][layer]; ctx.beginPath(); ctx.moveTo(0,360); for(let x=0;x<=WIDTH;x+=120){ const wx=x+state.camera*(.08+layer*.05); ctx.lineTo(x,(levelIndex===0?335:250)+layer*(levelIndex===0?22:45)+Math.sin(wx*.009)*(levelIndex===0?12:40)); } ctx.lineTo(WIDTH,460); ctx.lineTo(0,460); ctx.fill(); }
      for(let layer=0;layer<2;layer++){const step=layer?118:145;const parallax=layer ? .38 : .24;const shift=-(state.camera*parallax%step);for(let i=-1;i<Math.ceil(WIDTH/step)+1;i++){const n=Math.abs(i+Math.floor(state.camera*parallax/step));const w=65+(n*37%58);const h=85+(n*61%145);const x=shift+i*step;const y=450-h;ctx.fillStyle=layer?"#111723":"#20283c";ctx.fillRect(x,y,w,h);if(n%4===0){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y-28);ctx.lineTo(x+w,y);ctx.fill();}if(n%4===1){ctx.fillRect(x+w*.45,y-24,4,24);ctx.fillRect(x+w*.35,y-24,w*.24,4);}ctx.fillStyle=layer?"#d55b43":"#5f6072";for(let wx=x+13;wx<x+w-8;wx+=22)for(let wy=y+20;wy<435;wy+=29)ctx.fillRect(wx,wy,8,9);}}
      ctx.fillStyle="#272f36"; ctx.fillRect(0,450,WIDTH,90); ctx.fillStyle="#3b4548"; ctx.fillRect(0,450,WIDTH,7);
      if(levelIndex===0){ctx.fillStyle="#c9aa72";ctx.fillRect(0,450,WIDTH,90);ctx.fillStyle="#e8ce91";ctx.fillRect(0,450,WIDTH,7);}if(levelIndex===2){ctx.fillStyle="#202a2d";ctx.fillRect(0,450,WIDTH,90);ctx.strokeStyle="#526064";for(let x=-(state.camera%90);x<WIDTH;x+=90){ctx.strokeRect(x,450,90,90);}ctx.fillStyle="#202a2d";}if(levelIndex===3){ctx.fillStyle="#21181a";ctx.fillRect(0,450,WIDTH,90);ctx.fillStyle="#ff572b";for(let x=-(state.camera*.2%180);x<WIDTH;x+=180)ctx.fillRect(x,515,110,5);}
      for(const o of state.obstacles){const x=o.x-state.camera;if(x>-100&&x<WIDTH+100)drawObstacle(o,x);}
      for(const e of state.enemies){if(!e.alive)continue;const x=e.x-state.camera;if(x>-80&&x<WIDTH+80){if(atlasReady){const cellW=animeAtlas.width/4;const cellH=animeAtlas.height/2;ctx.save();ctx.translate(x+(e.facing<0?38:0),0);ctx.scale(e.facing,1);ctx.drawImage(animeAtlas,e.variant*cellW,cellH,cellW,cellH,-18,e.y-41,82,88);ctx.restore();}else{ctx.save();ctx.translate(x+(e.facing<0?34:0),e.y);ctx.scale(e.facing,1);ctx.fillStyle="#351e29";ctx.fillRect(0,0,34,43);ctx.fillStyle="#8cffcf";ctx.fillRect(5,8,7,4);ctx.fillRect(22,8,7,4);ctx.fillStyle="#bf4859";ctx.fillRect(28,19,21,7);ctx.restore();}}}
      for(const b of state.bullets){ctx.fillStyle=b.enemy?"#ff5973":"#ffd15b";ctx.fillRect(b.x-state.camera,b.y,b.enemy?9:14,4);}
      for(const p of state.particles){ctx.globalAlpha=p.life/24;ctx.fillStyle=p.color;ctx.fillRect(p.x-state.camera,p.y,4,4);}ctx.globalAlpha=1;
      drawHero(state.player.x-state.camera,state.player.y,state.player.facing);
      ctx.fillStyle="rgba(9,13,24,.82)";ctx.fillRect(24,22,300,72);ctx.fillStyle="#f4efe3";ctx.font="700 15px Arial";ctx.fillText(hero.name.toUpperCase(),42,48);ctx.fillStyle="#2b343e";ctx.fillRect(42,59,150,12);ctx.fillStyle=state.player.hp>35?"#67e6a4":"#f15d67";ctx.fillRect(42,59,150*Math.max(0,state.player.hp)/100,12);ctx.fillStyle="#f4efe3";ctx.fillText(`${state.score.toString().padStart(5,"0")} PTS`,214,69);
      ctx.fillStyle="#2b343e";ctx.fillRect(350,34,410,12);ctx.fillStyle=hero.accent;ctx.fillRect(350,34,410*Math.min(1,state.distance/LEVEL_END),12);ctx.fillStyle="#dce2e7";ctx.font="700 12px Arial";ctx.fillText(`LEVEL ${levelIndex+1}: ${level.name.toUpperCase()}`,350,66);ctx.fillText("EXTRACTION",770,45);
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1.7,(now-last)/16.67); last=now;
      const p=state.player; const k=keys.current;
      const speed=(k.ShiftLeft||k.ShiftRight)?7:5;
      if(k.KeyD||k.ArrowRight){p.x+=speed*dt;p.facing=1;}if(k.KeyA||k.ArrowLeft){p.x-=speed*dt;p.facing=-1;}
      p.x=Math.max(state.camera+30,p.x);state.distance=Math.max(state.distance,p.x-140);
      const jumpPressed = Boolean(k.KeyW||k.ArrowUp||k.Space);
      if(jumpPressed&&!state.jumpHeld&&p.jumpsLeft>0){p.vy=-13.5;p.grounded=false;p.jumpsLeft--;burst(p.x+20,p.y+44,hero.accent,5);sfx(p.jumpsLeft?310:430,.08,"sine");}
      state.jumpHeld=jumpPressed;
      p.vy+=.7*dt;p.y+=p.vy*dt;if(p.y>=390){p.y=390;p.vy=0;p.grounded=true;p.jumpsLeft=2;}
      p.cooldown-=dt;p.invuln-=dt;if((k.KeyF||k.KeyJ||k.ControlLeft)&&p.cooldown<=0){state.bullets.push({x:p.x+(p.facing>0?54:-14),y:p.y+20,vx:15*p.facing});p.cooldown=10;sfx(hero.id==="granny"?75:135,.045,"sawtooth");}
      state.camera=Math.max(0,Math.min(LEVEL_END-WIDTH+200,p.x-260));
      for(const o of state.obstacles){const box={x:o.x,y:450-o.h,w:o.w,h:o.h};if(rectHit({x:p.x,y:p.y,w:40,h:48},box)&&p.invuln<=0){p.hp-=14;p.invuln=45;p.x-=35;burst(p.x,p.y+25,"#ff6579");}}
      for(const e of state.enemies){if(!e.alive)continue;e.facing=p.x<e.x?-1:1;e.cooldown-=dt;if(Math.abs(e.x-p.x)<520&&e.cooldown<=0){const danger=Math.min(3,Math.floor(e.x/LEVEL_LENGTH));state.bullets.push({x:e.x+(e.facing>0?45:-10),y:p.y+20,vx:(7+danger*1.4)*e.facing,enemy:true});e.cooldown=100-danger*16+Math.random()*40;sfx(85+danger*18,.035,"square");}}
      for(const b of state.bullets)b.x+=b.vx*dt;
      for(const b of state.bullets){if(b.enemy&&rectHit({x:b.x,y:b.y,w:9,h:4},{x:p.x,y:p.y,w:40,h:48})&&p.invuln<=0){p.hp-=10;p.invuln=35;b.x=-999;burst(p.x,p.y+20,"#ff6579");sfx(58,.16,"sawtooth");}if(!b.enemy)for(const e of state.enemies){if(e.alive&&rectHit({x:b.x,y:b.y,w:14,h:4},{x:e.x,y:e.y,w:34,h:43})){e.hp--;b.x=99999;burst(e.x,e.y+18,"#ffb13b");sfx(220,.05,"square");if(e.hp<=0){e.alive=false;state.score+=100;sfx(95,.18,"sawtooth");}}}}
      state.bullets=state.bullets.filter(b=>b.x>state.camera-100&&b.x<state.camera+WIDTH+150);
      for(const q of state.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.2;q.life--;}state.particles=state.particles.filter(q=>q.life>0);
      if(p.hp<=0){setMode("lost");return;}if(state.distance>=LEVEL_END-300){setMode("won");return;}
      draw();frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(frameRef.current);
  },[hero,mode]);

  return <main className="game-shell">
    <header><div className="brand"><span>R<span>&</span>G</span><div>RUN &amp; GUN<small>LAST LIGHT</small></div></div><button className="sound" onClick={()=>{ensureAudio();setMuted(!muted)}} aria-label="Toggle sound">{muted?"SOUND OFF":"SOUND ON"}</button></header>
    <section className="stage-wrap">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Side-scrolling shooter game" />
      {mode==="playing"&&isMobile&&<div className="mobile-controls" aria-label="Touch game controls">
        <div className="move-controls">
          <button aria-label="Move left" onPointerDown={e=>{e.preventDefault();touchKey("KeyA",true)}} onPointerUp={()=>touchKey("KeyA",false)} onPointerCancel={()=>touchKey("KeyA",false)} onPointerLeave={()=>touchKey("KeyA",false)}>◀</button>
          <button aria-label="Move right" onPointerDown={e=>{e.preventDefault();touchKey("KeyD",true)}} onPointerUp={()=>touchKey("KeyD",false)} onPointerCancel={()=>touchKey("KeyD",false)} onPointerLeave={()=>touchKey("KeyD",false)}>▶</button>
        </div>
        <div className="action-controls">
          <button className="jump-control" aria-label="Jump or double jump" onPointerDown={e=>{e.preventDefault();touchKey("Space",true)}} onPointerUp={()=>touchKey("Space",false)} onPointerCancel={()=>touchKey("Space",false)}>JUMP</button>
          <button className="fire-control" aria-label="Fire weapon" onPointerDown={e=>{e.preventDefault();touchKey("KeyF",true)}} onPointerUp={()=>touchKey("KeyF",false)} onPointerCancel={()=>touchKey("KeyF",false)}>FIRE</button>
        </div>
      </div>}
      {mode==="select"&&<div className="overlay select"><p className="eyebrow">OPERATIVE SELECT</p><h1>Choose your chaos.</h1><p className="lede">Four escalating combat zones stand between your operative and extraction.</p><div className="heroes">{HEROES.map((h,i)=><button key={h.id} className={`hero-card ${hero.id===h.id?"active":""}`} onClick={()=>setHero(h)} style={{"--accent":h.accent} as React.CSSProperties}><span className={`portrait anime ${h.id}`} style={{backgroundImage:"url('sprites/anime-atlas.png')",backgroundSize:"400% 200%",backgroundPosition:`${i*33.333}% 0%`}} /><strong>{h.name}</strong><small>{h.tag}</small><p>{h.bio}</p></button>)}</div><button className="deploy" onClick={start}>DEPLOY {hero.name.toUpperCase()} <span>→</span></button></div>}
      {(mode==="won"||mode==="lost")&&<div className="overlay result"><p className="eyebrow">{mode==="won"?"MISSION COMPLETE":"OPERATIVE DOWN"}</p><h1>{mode==="won"?"Extraction secured.":"The city wins this round."}</h1><button className="deploy" onClick={start}>RUN IT AGAIN <span>↻</span></button><button className="change" onClick={()=>setMode("select")}>CHANGE OPERATIVE</button></div>}
    </section>
    <footer><div><kbd>A</kbd><kbd>D</kbd><span>MOVE + AIM</span></div><div><kbd>W</kbd><span>DOUBLE JUMP</span></div><div><kbd>F</kbd><span>FIRE</span></div><div><kbd>SHIFT</kbd><span>SPRINT</span></div><p>4 ZONES: BEACH · VILLAGE · BUNKER · VOLCANO</p></footer>
  </main>;
}
