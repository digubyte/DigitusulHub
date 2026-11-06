"use client";
/**
 * Renderizador do flyer (react-konva). Usado na prévia (somente leitura) e no
 * editor (seleção, arrastar, redimensionar, rotacionar, grade e guias).
 * Textos, preços e logotipo são objetos vetoriais/editáveis — nunca pixels gerados por IA.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Ellipse, Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useImage } from "./image-cache";
import type { FlyerDocument, FlyerElement, ImageElement } from "../domain/types";

export interface StageHandle {
  /** Exporta exatamente nas dimensões do documento (pixelRatio compensa o zoom). */
  toDataURL: (opts: { mimeType: "image/png" | "image/jpeg"; quality?: number; maxSide?: number }) => string;
}

interface Props {
  doc: FlyerDocument;
  scale: number;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<FlyerElement>) => void;
  showGrid?: boolean;
  gridSize?: number;
  snap?: boolean;
}

const SNAP_DIST = 8;

export const FlyerStage = forwardRef<StageHandle, Props>(function FlyerStage({ doc, scale, editable, selectedId, onSelect, onChange, showGrid, gridSize = 40, snap }, ref) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const overlayRef = useRef<Konva.Layer>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  useImperativeHandle(ref, () => ({
    toDataURL: ({ mimeType, quality, maxSide }) => {
      const stage = stageRef.current!;
      const overlay = overlayRef.current;
      overlay?.hide();
      trRef.current?.nodes([]);
      const target = maxSide ? Math.min(1, maxSide / Math.max(doc.width, doc.height)) : 1;
      // Renderiza em escala 1:1 (dimensões exatas do formato) e restaura o zoom em seguida.
      const prev = { width: stage.width(), height: stage.height(), sx: stage.scaleX(), sy: stage.scaleY() };
      stage.size({ width: doc.width, height: doc.height });
      stage.scale({ x: 1, y: 1 });
      try {
        return stage.toDataURL({ x: 0, y: 0, width: doc.width, height: doc.height, pixelRatio: target, mimeType, quality });
      } finally {
        stage.size({ width: prev.width, height: prev.height });
        stage.scale({ x: prev.sx, y: prev.sy });
        overlay?.show();
        stage.batchDraw();
      }
    },
  }), [doc.width, doc.height, scale]);

  // Liga o Transformer ao elemento selecionado
  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected && !selected.locked && selected.visible ? stageRef.current?.findOne(`#${CSS.escape(selected.id)}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, doc]);

  const keepRatio = selected?.type === "image";
  const isLogo = selected?.role === "logo";

  function snapPos(e: FlyerElement, x: number, y: number) {
    let nx = x, ny = y;
    const v: number[] = [], h: number[] = [];
    if (snap && gridSize > 0) { nx = Math.round(nx / gridSize) * gridSize; ny = Math.round(ny / gridSize) * gridSize; }
    // Guias de centro e bordas da página
    const thr = SNAP_DIST / scale;
    const cx = nx + e.width / 2, cy = ny + e.height / 2;
    if (Math.abs(cx - doc.width / 2) < thr) { nx = doc.width / 2 - e.width / 2; v.push(doc.width / 2); }
    if (Math.abs(cy - doc.height / 2) < thr) { ny = doc.height / 2 - e.height / 2; h.push(doc.height / 2); }
    return { x: nx, y: ny, v, h };
  }

  const common = (e: FlyerElement) => ({
    id: e.id,
    x: e.x,
    y: e.y,
    rotation: e.rotation,
    opacity: e.opacity,
    visible: e.visible,
    draggable: !!editable && !e.locked,
    listening: !!editable,
    onMouseDown: () => editable && onSelect?.(e.id),
    onTap: () => editable && onSelect?.(e.id),
    onDragMove: (ev: Konva.KonvaEventObject<DragEvent>) => {
      const s = snapPos(e, ev.target.x(), ev.target.y());
      ev.target.position({ x: s.x, y: s.y });
      setGuides({ v: s.v, h: s.h });
    },
    onDragEnd: (ev: Konva.KonvaEventObject<DragEvent>) => {
      setGuides({ v: [], h: [] });
      onChange?.(e.id, { x: round(ev.target.x()), y: round(ev.target.y()) });
    },
    onTransformEnd: (ev: Konva.KonvaEventObject<Event>) => {
      const n = ev.target;
      const sx = n.scaleX(), sy = n.scaleY();
      n.scaleX(1); n.scaleY(1);
      let width = Math.max(4, e.width * sx), height = Math.max(4, e.height * sy);
      if (e.type === "image") {
        // Proporção sempre preservada para imagens (produto, logotipo, mascote)
        const k = Math.max(sx, sy);
        width = Math.max(4, e.width * k); height = Math.max(4, e.height * k);
      }
      onChange?.(e.id, { x: round(n.x()), y: round(n.y()), width: round(width), height: round(height), rotation: round(n.rotation()) });
    },
  });

  return (
    <Stage
      ref={stageRef}
      width={Math.round(doc.width * scale)}
      height={Math.round(doc.height * scale)}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(ev) => { if (editable && (ev.target === ev.target.getStage() || ev.target.name() === "bg")) onSelect?.(null); }}
      onTouchStart={(ev) => { if (editable && (ev.target === ev.target.getStage() || ev.target.name() === "bg")) onSelect?.(null); }}
      style={{ background: "#fff" }}
    >
      <Layer>
        <Rect name="bg" x={0} y={0} width={doc.width} height={doc.height} fill={doc.background.color} />
        {doc.background.imageFileId && <BackgroundImage fileId={doc.background.imageFileId} w={doc.width} h={doc.height} />}
        {doc.elements.map((e) => {
          const c = common(e);
          switch (e.type) {
            case "text":
              return (
                <Text key={e.id} {...c} width={e.width} height={e.height} text={e.text} fontFamily={e.fontFamily} fontSize={e.fontSize}
                  fontStyle={normalizeFontStyle(e.fontStyle)} fill={e.fill} align={e.align} verticalAlign={e.verticalAlign}
                  lineHeight={e.lineHeight} letterSpacing={e.letterSpacing} wrap="word" />
              );
            case "image":
              return <ImageNode key={e.id} el={e} common={c} />;
            case "rect":
              return (
                <Rect key={e.id} {...c} width={e.width} height={e.height} fill={e.fill} stroke={e.stroke || undefined} strokeWidth={e.strokeWidth}
                  cornerRadius={e.cornerRadius} shadowColor={e.shadow ? "rgba(15,23,42,0.35)" : undefined} shadowBlur={e.shadow ? 24 : 0} shadowOffsetY={e.shadow ? 8 : 0} shadowOpacity={e.shadow ? 0.25 : 0} />
              );
            case "ellipse":
              return (
                <Group key={e.id} {...c}>
                  <Ellipse x={e.width / 2} y={e.height / 2} radiusX={e.width / 2} radiusY={e.height / 2} fill={e.fill} stroke={e.stroke || undefined} strokeWidth={e.strokeWidth} />
                  <Rect width={e.width} height={e.height} fill="transparent" />
                </Group>
              );
            case "polygon":
              return (
                <Group key={e.id} {...c}>
                  <Line points={e.points.map((p, i) => (i % 2 === 0 ? p * e.width : p * e.height))} closed fill={e.fill} />
                  <Rect width={e.width} height={e.height} fill="transparent" />
                </Group>
              );
          }
        })}
      </Layer>
      {editable && (
        <Layer ref={overlayRef}>
          {showGrid && <Grid w={doc.width} h={doc.height} size={gridSize} scale={scale} />}
          {guides.v.map((x) => <Line key={`v${x}`} points={[x, 0, x, doc.height]} stroke="#E61F27" strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
          {guides.h.map((y) => <Line key={`h${y}`} points={[0, y, doc.width, y]} stroke="#E61F27" strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
          {selected?.locked && <Rect x={selected.x} y={selected.y} width={selected.width} height={selected.height} rotation={selected.rotation} stroke="#94a3b8" strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} listening={false} />}
          <Transformer
            ref={trRef}
            keepRatio={keepRatio}
            rotateEnabled={!isLogo}
            enabledAnchors={keepRatio ? ["top-left", "top-right", "bottom-left", "bottom-right"] : undefined}
            anchorSize={9}
            borderStroke="#2341C1"
            anchorStroke="#2341C1"
            anchorCornerRadius={2}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 6 || newBox.height < 6 ? oldBox : newBox)}
          />
        </Layer>
      )}
    </Stage>
  );
});

const round = (n: number) => Math.round(n * 100) / 100;
/** Konva aceita "normal", "bold", "italic" e pesos numéricos ("800", "900"). */
function normalizeFontStyle(s: string) {
  return s;
}

function Grid({ w, h, size, scale }: { w: number; h: number; size: number; scale: number }) {
  const lines = [];
  for (let x = size; x < w; x += size) lines.push(<Line key={`gx${x}`} points={[x, 0, x, h]} stroke="#2341C1" opacity={0.12} strokeWidth={1 / scale} listening={false} />);
  for (let y = size; y < h; y += size) lines.push(<Line key={`gy${y}`} points={[0, y, w, y]} stroke="#2341C1" opacity={0.12} strokeWidth={1 / scale} listening={false} />);
  return <>{lines}</>;
}

function BackgroundImage({ fileId, w, h }: { fileId: string; w: number; h: number }) {
  const img = useImage(fileId);
  if (!img) return null;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const cw = w / s, ch = h / s;
  return <KImage name="bg" image={img} x={0} y={0} width={w} height={h} crop={{ x: (img.naturalWidth - cw) / 2, y: (img.naturalHeight - ch) / 2, width: cw, height: ch }} />;
}

function ImageNode({ el, common }: { el: ImageElement; common: Record<string, unknown> }) {
  const img = useImage(el.fileId);
  if (!img) {
    return <Rect {...common} width={el.width} height={el.height} fill="#F1F5F9" stroke="#CBD5E1" dash={[8, 6]} strokeWidth={2} />;
  }
  const nw = img.naturalWidth || el.naturalWidth, nh = img.naturalHeight || el.naturalHeight;
  if (el.fit === "cover") {
    const s = Math.max(el.width / nw, el.height / nh) * el.zoom;
    const cw = el.width / s, ch = el.height / s;
    return <KImage {...common} image={img} width={el.width} height={el.height} cornerRadius={el.cornerRadius} crop={{ x: (nw - cw) * el.focusX, y: (nh - ch) * el.focusY, width: cw, height: ch }} />;
  }
  // contain: imagem inteira, centralizada, sem distorção
  const s = Math.min(el.width / nw, el.height / nh);
  const dw = nw * s, dh = nh * s;
  return (
    <Group {...common}>
      <Rect width={el.width} height={el.height} fill="transparent" />
      <KImage image={img} x={(el.width - dw) / 2} y={(el.height - dh) / 2} width={dw} height={dh} cornerRadius={el.cornerRadius} listening={false} />
    </Group>
  );
}
