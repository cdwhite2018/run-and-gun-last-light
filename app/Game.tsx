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
const LEVEL_END = 7200;
const OBSTACLE_TYPES = ["hydrant", "alligator", "trashcan", "toilet", "tiki", "stereo", "drums"] as const;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const keys = useRef<Record<string, boolean>>({});
  const [hero, setHero] = useState<Hero>(HEROES[0]);
  const [mode, setMode] = useState<"select" | "playing" | "won" | "lost">("select");
  const [muted, setMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const start = useCallback(() => setMode("playing"), []);

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
      obstacles: Array.from({ length: 19 }, (_, i) => {
        const kind = OBSTACLE_TYPES[i % OBSTACLE_TYPES.length];
        const sizes = { hydrant:[42,55], alligator:[82,30], trashcan:[48,65], toilet:[55,54], tiki:[34,92], stereo:[70,43], drums:[76,58] } as const;
        return { x: 650 + i * 330 + (i % 3) * 80, kind, w:sizes[kind][0], h:sizes[kind][1] };
      }),
      enemies: Array.from({ length: 22 }, (_, i) => ({ x: 820 + i * 285, y: 407, hp: i % 6 === 5 ? 3 : 1, cooldown: 40 + (i * 17) % 80, alive: true, facing: -1 })),
    };

    const burst = (x: number, y: number, color: string, amount = 8) => {
      for (let i = 0; i < amount; i++) state.particles.push({ x, y, vx: Math.random() * 5 - 2.5, vy: Math.random() * -4, life: 24, color });
    };
    const rectHit = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

    const drawHero = (x: number, y: number, facing: number) => {
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
      if(o.kind==="hydrant"){ctx.fillStyle="#c83e3d";ctx.fillRect(9,14,24,o.h-14);ctx.fillStyle="#f06a51";ctx.fillRect(4,10,34,10);ctx.fillRect(13,2,16,10);ctx.fillStyle="#8e292c";ctx.fillRect(0,25,9,13);ctx.fillRect(33,25,9,13);}
      if(o.kind==="alligator"){ctx.fillStyle="#496d45";ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(18,7);ctx.lineTo(60,6);ctx.lineTo(82,20);ctx.lineTo(59,29);ctx.lineTo(16,28);ctx.closePath();ctx.fill();ctx.fillStyle="#cbe36a";ctx.fillRect(56,11,6,4);ctx.fillStyle="#f3efe0";for(let i=0;i<4;i++)ctx.fillRect(64+i*4,20,3,5);ctx.fillStyle="#233629";ctx.fillRect(55,7,5,5);}
      if(o.kind==="trashcan"){ctx.fillStyle="#65727b";ctx.fillRect(4,10,40,o.h-10);ctx.fillStyle="#9ba5a9";ctx.fillRect(0,5,48,10);ctx.fillRect(12,0,24,6);ctx.fillStyle="#3d474e";for(let i=10;i<42;i+=10)ctx.fillRect(i,18,4,o.h-23);}
      if(o.kind==="toilet"){ctx.fillStyle="#dedbd1";ctx.fillRect(3,0,27,27);ctx.fillStyle="#f5f2e8";ctx.beginPath();ctx.ellipse(31,28,24,12,0,0,Math.PI*2);ctx.fill();ctx.fillRect(19,28,27,22);ctx.fillStyle="#7ba8ae";ctx.beginPath();ctx.ellipse(31,28,15,6,0,0,Math.PI*2);ctx.fill();}
      if(o.kind==="tiki"){ctx.fillStyle="#77452d";ctx.fillRect(14,26,7,o.h-26);ctx.fillStyle="#ff9e3d";ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(31,24);ctx.lineTo(3,24);ctx.closePath();ctx.fill();ctx.fillStyle="#ffd55f";ctx.beginPath();ctx.moveTo(17,5);ctx.lineTo(24,21);ctx.lineTo(10,21);ctx.closePath();ctx.fill();}
      if(o.kind==="stereo"){ctx.fillStyle="#292d38";ctx.fillRect(0,5,70,38);ctx.fillStyle="#697181";ctx.fillRect(6,10,58,8);ctx.fillStyle="#12151c";ctx.beginPath();ctx.arc(17,30,9,0,Math.PI*2);ctx.arc(53,30,9,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e84b66";ctx.fillRect(32,11,7,3);ctx.strokeStyle="#9ca6b5";ctx.beginPath();ctx.moveTo(12,5);ctx.lineTo(22,-8);ctx.stroke();}
      if(o.kind==="drums"){ctx.fillStyle="#9b3e50";ctx.beginPath();ctx.arc(38,31,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e5b86a";ctx.stroke();ctx.fillStyle="#b54d5a";ctx.fillRect(2,23,25,24);ctx.fillRect(51,23,25,24);ctx.strokeRect(2,23,25,24);ctx.strokeRect(51,23,25,24);ctx.strokeStyle="#cdd2d5";ctx.beginPath();ctx.moveTo(26,12);ctx.lineTo(58,45);ctx.moveTo(53,10);ctx.lineTo(25,45);ctx.stroke();}
      ctx.restore();
    };

    const draw = () => {
      const sky = ctx.createLinearGradient(0,0,0,HEIGHT); sky.addColorStop(0,"#11182d"); sky.addColorStop(1,"#453040"); ctx.fillStyle=sky; ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle="#f16b4c"; ctx.beginPath(); ctx.arc(760,120,54,0,Math.PI*2); ctx.fill();
      for (let layer=0; layer<3; layer++) { ctx.fillStyle=["#222944","#1c2439","#151b2b"][layer]; ctx.beginPath(); ctx.moveTo(0,360); for(let x=0;x<=WIDTH;x+=120){ const wx=x+state.camera*(.08+layer*.05); ctx.lineTo(x,250+layer*45+Math.sin(wx*.009)*40); } ctx.lineTo(WIDTH,460); ctx.lineTo(0,460); ctx.fill(); }
      for(let layer=0;layer<2;layer++){const step=layer?118:145;const parallax=layer ? .38 : .24;const shift=-(state.camera*parallax%step);for(let i=-1;i<Math.ceil(WIDTH/step)+1;i++){const n=Math.abs(i+Math.floor(state.camera*parallax/step));const w=65+(n*37%58);const h=85+(n*61%145);const x=shift+i*step;const y=450-h;ctx.fillStyle=layer?"#111723":"#20283c";ctx.fillRect(x,y,w,h);if(n%4===0){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y-28);ctx.lineTo(x+w,y);ctx.fill();}if(n%4===1){ctx.fillRect(x+w*.45,y-24,4,24);ctx.fillRect(x+w*.35,y-24,w*.24,4);}ctx.fillStyle=layer?"#d55b43":"#5f6072";for(let wx=x+13;wx<x+w-8;wx+=22)for(let wy=y+20;wy<435;wy+=29)ctx.fillRect(wx,wy,8,9);}}
      ctx.fillStyle="#272f36"; ctx.fillRect(0,450,WIDTH,90); ctx.fillStyle="#3b4548"; ctx.fillRect(0,450,WIDTH,7);
      for(const o of state.obstacles){const x=o.x-state.camera;if(x>-100&&x<WIDTH+100)drawObstacle(o,x);}
      for(const e of state.enemies){if(!e.alive)continue;const x=e.x-state.camera;if(x>-60&&x<WIDTH+60){ctx.save();ctx.translate(x+(e.facing<0?34:0),e.y);ctx.scale(e.facing,1);ctx.fillStyle="#351e29";ctx.fillRect(0,0,34,43);ctx.fillStyle="#8cffcf";ctx.fillRect(5,8,7,4);ctx.fillRect(22,8,7,4);ctx.fillStyle="#bf4859";ctx.fillRect(28,19,21,7);ctx.fillStyle="#762d3b";ctx.fillRect(8,27,18,5);ctx.restore();}}
      for(const b of state.bullets){ctx.fillStyle=b.enemy?"#ff5973":"#ffd15b";ctx.fillRect(b.x-state.camera,b.y,b.enemy?9:14,4);}
      for(const p of state.particles){ctx.globalAlpha=p.life/24;ctx.fillStyle=p.color;ctx.fillRect(p.x-state.camera,p.y,4,4);}ctx.globalAlpha=1;
      drawHero(state.player.x-state.camera,state.player.y,state.player.facing);
      ctx.fillStyle="rgba(9,13,24,.82)";ctx.fillRect(24,22,300,72);ctx.fillStyle="#f4efe3";ctx.font="700 15px Arial";ctx.fillText(hero.name.toUpperCase(),42,48);ctx.fillStyle="#2b343e";ctx.fillRect(42,59,150,12);ctx.fillStyle=state.player.hp>35?"#67e6a4":"#f15d67";ctx.fillRect(42,59,150*Math.max(0,state.player.hp)/100,12);ctx.fillStyle="#f4efe3";ctx.fillText(`${state.score.toString().padStart(5,"0")} PTS`,214,69);
      ctx.fillStyle="#2b343e";ctx.fillRect(350,34,410,12);ctx.fillStyle=hero.accent;ctx.fillRect(350,34,410*Math.min(1,state.distance/LEVEL_END),12);ctx.fillStyle="#dce2e7";ctx.font="12px Arial";ctx.fillText("EXTRACTION",770,45);
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1.7,(now-last)/16.67); last=now;
      const p=state.player; const k=keys.current;
      const speed=(k.ShiftLeft||k.ShiftRight)?7:5;
      if(k.KeyD||k.ArrowRight){p.x+=speed*dt;p.facing=1;}if(k.KeyA||k.ArrowLeft){p.x-=speed*dt;p.facing=-1;}
      p.x=Math.max(state.camera+30,p.x);state.distance=Math.max(state.distance,p.x-140);
      const jumpPressed = Boolean(k.KeyW||k.ArrowUp||k.Space);
      if(jumpPressed&&!state.jumpHeld&&p.jumpsLeft>0){p.vy=-13.5;p.grounded=false;p.jumpsLeft--;burst(p.x+20,p.y+44,hero.accent,5);}
      state.jumpHeld=jumpPressed;
      p.vy+=.7*dt;p.y+=p.vy*dt;if(p.y>=390){p.y=390;p.vy=0;p.grounded=true;p.jumpsLeft=2;}
      p.cooldown-=dt;p.invuln-=dt;if((k.KeyF||k.KeyJ||k.ControlLeft)&&p.cooldown<=0){state.bullets.push({x:p.x+(p.facing>0?54:-14),y:p.y+20,vx:15*p.facing});p.cooldown=10;}
      state.camera=Math.max(0,Math.min(LEVEL_END-WIDTH+200,p.x-260));
      for(const o of state.obstacles){const box={x:o.x,y:450-o.h,w:o.w,h:o.h};if(rectHit({x:p.x,y:p.y,w:40,h:48},box)&&p.invuln<=0){p.hp-=14;p.invuln=45;p.x-=35;burst(p.x,p.y+25,"#ff6579");}}
      for(const e of state.enemies){if(!e.alive)continue;e.facing=p.x<e.x?-1:1;e.cooldown-=dt;if(Math.abs(e.x-p.x)<520&&e.cooldown<=0){state.bullets.push({x:e.x+(e.facing>0?45:-10),y:p.y+20,vx:7*e.facing,enemy:true});e.cooldown=90+Math.random()*60;}}
      for(const b of state.bullets)b.x+=b.vx*dt;
      const friendly=state.bullets.filter(b=>!b.enemy);const hostile=state.bullets.filter(b=>b.enemy);
      for(const shot of friendly)for(const threat of hostile){if(Math.abs(shot.x-threat.x)<19&&Math.abs(shot.y-threat.y)<12){const hitX=(shot.x+threat.x)/2;shot.x=99999;threat.x=-999;burst(hitX,(shot.y+threat.y)/2,"#fff1a8",8);state.score+=10;}}
      for(const b of state.bullets){if(b.enemy&&rectHit({x:b.x,y:b.y,w:9,h:4},{x:p.x,y:p.y,w:40,h:48})&&p.invuln<=0){p.hp-=10;p.invuln=35;b.x=-999;burst(p.x,p.y+20,"#ff6579");}if(!b.enemy)for(const e of state.enemies){if(e.alive&&rectHit({x:b.x,y:b.y,w:14,h:4},{x:e.x,y:e.y,w:34,h:43})){e.hp--;b.x=99999;burst(e.x,e.y+18,"#ffb13b");if(e.hp<=0){e.alive=false;state.score+=100;}}}}
      state.bullets=state.bullets.filter(b=>b.x>state.camera-100&&b.x<state.camera+WIDTH+150);
      for(const q of state.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.2;q.life--;}state.particles=state.particles.filter(q=>q.life>0);
      if(p.hp<=0){setMode("lost");return;}if(state.distance>=LEVEL_END-300){setMode("won");return;}
      draw();frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(frameRef.current);
  },[hero,mode]);

  return <main className="game-shell">
    <header><div className="brand"><span>R<span>&</span>G</span><div>RUN &amp; GUN<small>LAST LIGHT</small></div></div><button className="sound" onClick={()=>setMuted(!muted)} aria-label="Toggle sound">{muted?"SOUND OFF":"SOUND ON"}</button></header>
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
      {mode==="select"&&<div className="overlay select"><p className="eyebrow">OPERATIVE SELECT</p><h1>Choose your chaos.</h1><p className="lede">One ruined city. Four wildly different heroes. Reach extraction.</p><div className="heroes">{HEROES.map(h=><button key={h.id} className={`hero-card ${hero.id===h.id?"active":""}`} onClick={()=>setHero(h)} style={{"--accent":h.accent} as React.CSSProperties}><span className={`portrait ${h.id}`}><i /></span><strong>{h.name}</strong><small>{h.tag}</small><p>{h.bio}</p></button>)}</div><button className="deploy" onClick={start}>DEPLOY {hero.name.toUpperCase()} <span>→</span></button></div>}
      {(mode==="won"||mode==="lost")&&<div className="overlay result"><p className="eyebrow">{mode==="won"?"MISSION COMPLETE":"OPERATIVE DOWN"}</p><h1>{mode==="won"?"Extraction secured.":"The city wins this round."}</h1><button className="deploy" onClick={start}>RUN IT AGAIN <span>↻</span></button><button className="change" onClick={()=>setMode("select")}>CHANGE OPERATIVE</button></div>}
    </section>
    <footer><div><kbd>A</kbd><kbd>D</kbd><span>MOVE + AIM</span></div><div><kbd>W</kbd><span>DOUBLE JUMP</span></div><div><kbd>F</kbd><span>FIRE</span></div><div><kbd>SHIFT</kbd><span>SPRINT</span></div><p>TIP: Shoot incoming rounds out of the air.</p></footer>
  </main>;
}
