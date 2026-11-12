"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BALL, CLAWD, DIGU, HEART, LAPTOP_A, LAPTOP_B, SPARK, spriteRects } from "./sprites";

const PX = 3; // tamanho de cada "pixel"
const TICK = 150; // ms por frame

function Sprite({ rows, flip = false, title }: { rows: string[]; flip?: boolean; title?: string }) {
  const rects = useMemo(() => spriteRects(rows), [rows]);
  const w = rows[0].length, h = rows.length;
  return (
    <svg width={w * PX} height={h * PX} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden={!title} role={title ? "img" : undefined}
      style={{ transform: flip ? "scaleX(-1)" : undefined, display: "block" }}>
      {title && <title>{title}</title>}
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}

type Mode = "stand" | "walk" | "sit" | "type" | "cheer" | "peek" | "hidden";
interface Actor { x: number; mode: Mode; flip: boolean; dur: number; jump: boolean }
interface Props { laptop: number | null; ball: { from: number; to: number } | null; heart: number | null; spark: number | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * Digu e o mascote do Claude passeando por cima das caixas do painel, com cenas aleatórias:
 * correndo, sentados, usando o PC, brincando de bola, Digu espiando, "toca aqui".
 * Fica por cima do conteúdo, sem bloquear cliques. Pausa quando a aba não está visível.
 */
export function MascotStage({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const [digu, setDigu] = useState<Actor>({ x: -10, mode: "stand", flip: false, dur: 0, jump: false });
  const [clawd, setClawd] = useState<Actor>({ x: -22, mode: "stand", flip: false, dur: 0, jump: false });
  const [props, setProps] = useState<Props>({ laptop: null, ball: null, heart: null, spark: null });
  const alive = useRef(true);

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, TICK);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    alive.current = true;
    const pos = { digu: -10, clawd: -22 };
    const set = { digu: setDigu, clawd: setClawd };

    async function walk(who: "digu" | "clawd", to: number, speed = 70) {
      const from = pos[who];
      const dur = Math.abs(to - from) * speed;
      set[who]((a) => ({ ...a, mode: "walk", flip: to < from, dur, x: to, jump: false }));
      pos[who] = to;
      await sleep(dur);
      if (alive.current) set[who]((a) => ({ ...a, mode: "stand", dur: 0 }));
    }
    const mode = (who: "digu" | "clawd", m: Mode, flip?: boolean) => set[who]((a) => ({ ...a, mode: m, ...(flip === undefined ? {} : { flip }) }));
    const hop = async (who: "digu" | "clawd", times = 1) => {
      for (let i = 0; i < times && alive.current; i++) {
        set[who]((a) => ({ ...a, jump: true })); await sleep(260);
        set[who]((a) => ({ ...a, jump: false })); await sleep(220);
      }
    };
    const flash = async (key: "heart" | "spark", x: number, ms = 1600) => { setProps((p) => ({ ...p, [key]: x })); await sleep(ms); setProps((p) => ({ ...p, [key]: null })); };

    const scenes: Record<string, () => Promise<void>> = {
      async correndo() {
        await Promise.all([walk("digu", -10, 30), walk("clawd", -22, 30)]);
        await Promise.all([walk("digu", 108, 45), (async () => { await sleep(700); await walk("clawd", 104, 42); })()]);
      },
      async sentados() {
        const x = pick([8, 33, 58, 83]);
        await Promise.all([walk("digu", x), walk("clawd", x + 7)]);
        mode("digu", "sit", false); mode("clawd", "sit", true);
        await sleep(2500); await flash("heart", x + 4, 1400); await sleep(2500);
      },
      async computador() {
        const x = pick([20, 45, 70]);
        await Promise.all([walk("clawd", x), walk("digu", x - 8)]);
        setProps((p) => ({ ...p, laptop: x + 5 }));
        mode("clawd", "type", false); mode("digu", "sit", false);
        await sleep(3000);
        await hop("digu"); mode("digu", "cheer"); await flash("spark", x - 4, 1000); mode("digu", "sit");
        await sleep(2200);
        setProps((p) => ({ ...p, laptop: null })); mode("clawd", "stand");
      },
      async bola() {
        const a = rand(10, 45), b = a + 22;
        await Promise.all([walk("digu", a), walk("clawd", b)]);
        mode("digu", "stand", false); mode("clawd", "stand", true);
        for (let i = 0; i < 4 && alive.current; i++) {
          const left = i % 2 === 0;
          setProps((p) => ({ ...p, ball: { from: left ? a + 4 : b, to: left ? b : a + 4 } }));
          await sleep(900);
          await hop(left ? "clawd" : "digu");
        }
        setProps((p) => ({ ...p, ball: null }));
        mode("digu", "cheer"); mode("clawd", "cheer"); await sleep(1200);
      },
      async espiando() {
        const x = pick([12, 38, 63, 88]);
        await walk("digu", x, 25);
        mode("digu", "peek"); await sleep(1800);
        await walk("clawd", x - 9);
        mode("digu", "stand"); await hop("digu"); mode("digu", "cheer"); mode("clawd", "cheer");
        await flash("spark", x, 900); await sleep(600);
      },
      async tocaAqui() {
        await Promise.all([walk("digu", -10, 25), walk("clawd", 108, 25)]);
        await Promise.all([walk("digu", 44, 55), walk("clawd", 52, 55)]);
        mode("clawd", "stand", true);
        await Promise.all([hop("digu"), hop("clawd")]);
        mode("digu", "cheer"); mode("clawd", "cheer"); await flash("spark", 48, 1200);
      },
    };

    (async () => {
      await sleep(600);
      let last = "";
      while (alive.current) {
        const name = pick(Object.keys(scenes).filter((n) => n !== last));
        last = name;
        try { await scenes[name](); } catch { /* ignora */ }
        if (alive.current) { mode("digu", "stand"); mode("clawd", "stand"); }
        await sleep(rand(1200, 2600));
      }
    })();
    return () => { alive.current = false; };
  }, []);

  const f = tick % 2 === 0;
  const diguRows = { stand: DIGU.stand, walk: f ? DIGU.walkA : DIGU.walkB, sit: DIGU.sit, type: DIGU.sit, cheer: tick % 4 < 2 ? DIGU.cheer : DIGU.stand, peek: DIGU.peek, hidden: DIGU.stand }[digu.mode];
  const clawdRows = { stand: CLAWD.stand, walk: f ? CLAWD.walkA : CLAWD.walkB, sit: CLAWD.sit, type: CLAWD.sit, cheer: tick % 4 < 2 ? CLAWD.cheer : CLAWD.stand, peek: CLAWD.stand, hidden: CLAWD.stand }[clawd.mode];
  const actor = (a: Actor, rows: string[], bob: boolean, label: string) => (
    <div className="absolute bottom-full" style={{ left: `${a.x}%`, transition: `left ${a.dur}ms linear`, transform: `translate(-50%, ${a.jump ? -14 : bob ? -1 : 0}px)` }}>
      <div style={{ transition: "transform 180ms ease-out" }}><Sprite rows={rows} flip={a.flip} title={label} /></div>
    </div>
  );

  return (
    <div className="relative mt-16">
      {children}
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        {props.laptop !== null && <div className="absolute bottom-full" style={{ left: `${props.laptop}%`, transform: "translateX(-50%)" }}><Sprite rows={f ? LAPTOP_A : LAPTOP_B} /></div>}
        {actor(clawd, clawdRows, clawd.mode === "type" && f, "Mascote do Claude")}
        {actor(digu, diguRows, false, "Digu")}
        {props.ball && (
          <div key={`${props.ball.from}-${props.ball.to}`} className="mascot-ball absolute bottom-full" style={{ ["--from" as string]: `${props.ball.from}%`, ["--to" as string]: `${props.ball.to}%` }}>
            <Sprite rows={BALL} />
          </div>
        )}
        {props.heart !== null && <div className="mascot-float absolute bottom-full" style={{ left: `${props.heart}%` }}><Sprite rows={HEART} /></div>}
        {props.spark !== null && <div className="mascot-float absolute bottom-full" style={{ left: `${props.spark}%` }}><Sprite rows={SPARK} /></div>}
      </div>
    </div>
  );
}
