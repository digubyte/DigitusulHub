"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { api, ConfirmDialog, Field, Spinner } from "@/components/ui/primitives";
import { Dropzone, uploadFiles } from "@/components/upload/dropzone";
import { useToast } from "@/components/ui/toast";
import type { BrandKitView } from "@/modules/flyer-studio/services/brand-service";
import { CATEGORIES, EDITOR_FONTS } from "@/modules/flyer-studio/domain/brand";

const BRAND_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function BrandKitAdmin({ initial }: { initial: BrandKitView }) {
  const toast = useToast();
  const [kit, setKit] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removeAsset, setRemoveAsset] = useState<{ assetId: string; name: string } | null>(null);
  const [phrase, setPhrase] = useState({ category: "geral", text: "" });

  async function save(next = kit) {
    setSaving(true);
    try {
      const saved = await api<BrandKitView>("/api/admin/brand-kit", {
        method: "PUT",
        json: { colors: next.colors, fonts: next.fonts, rules: next.rules, approvedPhrases: next.approvedPhrases, logoFileId: next.logo?.fileId ?? null, logoOnDarkFileId: next.logoOnDark?.fileId ?? null },
      });
      setKit(saved);
      toast.success("Brand Kit salvo.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  async function uploadLogo(files: File[], which: "logo" | "logoOnDark") {
    setUploading(which);
    try {
      const [f] = await uploadFiles(files, "brand");
      await save({ ...kit, [which]: { fileId: f.id, url: f.url, width: f.width ?? 1000, height: f.height ?? 1000 } });
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(null); }
  }

  async function addAsset(files: File[], kind: "mascot" | "element") {
    setUploading(kind);
    try {
      const up = await uploadFiles(files, "brand");
      for (const f of up) await api("/api/admin/brand-assets", { method: "POST", json: { kind, name: f.name.replace(/\.[a-z]+$/i, ""), fileId: f.id } });
      setKit(await api<BrandKitView>("/api/admin/brand-kit"));
      toast.success(kind === "mascot" ? "Arquivo do mascote adicionado." : "Elemento adicionado.");
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(null); }
  }

  async function confirmRemove() {
    if (!removeAsset) return;
    try {
      await api(`/api/admin/brand-assets/${removeAsset.assetId}`, { method: "DELETE" });
      setKit(await api<BrandKitView>("/api/admin/brand-kit"));
      toast.success("Removido do Brand Kit.");
    } catch (e) { toast.error((e as Error).message); } finally { setRemoveAsset(null); }
  }

  const LogoSlot = ({ which, title, dark }: { which: "logo" | "logoOnDark"; title: string; dark?: boolean }) => {
    const ref = kit[which];
    return (
      <div className="card p-4">
        <p className="font-semibold">{title}</p>
        <div className={`my-3 flex h-36 items-center justify-center rounded-lg ${dark ? "bg-brand-950" : "bg-[conic-gradient(#f1f5f9_25%,#fff_0_50%,#f1f5f9_0_75%,#fff_0)] bg-[length:16px_16px]"}`}>
          {ref ? <img src={ref.url} alt={title} className="max-h-28 max-w-[85%] object-contain" /> : <span className="text-sm text-ink-muted">Não enviado</span>}
        </div>
        {ref && <p className="mb-2 text-xs text-ink-muted">{ref.width} × {ref.height} px (proporção preservada em todos os flyers)</p>}
        <Dropzone compact multiple={false} accept={BRAND_ACCEPT} busy={uploading === which} label={ref ? "Substituir arquivo" : "Enviar arquivo oficial"} onFiles={(f) => uploadLogo(f, which)} />
        {ref && which === "logoOnDark" && <button className="btn-ghost btn-sm mt-2 w-full" onClick={() => save({ ...kit, logoOnDark: null })}>Remover variante</button>}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Logotipo oficial</h2>
        <p className="mb-3 text-sm text-ink-muted">Envie o arquivo oficial da Digitusul (preferencialmente SVG ou PNG transparente, recortado rente ao desenho). O sistema nunca redesenha, recolore ou distorce o logotipo; em fundos escuros sem variante própria, ele é aplicado sobre uma placa branca.</p>
        {!kit.logo && <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />Sem logotipo cadastrado, os flyers são gerados sem a marca e a exportação exibe um alerta.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <LogoSlot which="logo" title="Logotipo principal" />
          <LogoSlot which="logoOnDark" title="Variante para fundo escuro (opcional)" dark />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paleta de cores</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kit.colors.map((c, i) => (
            <div key={c.key} className="card flex items-center gap-3 p-3">
              <input type="color" value={c.hex} aria-label={`Cor ${c.name}`} className="h-12 w-12 cursor-pointer rounded-lg border border-zinc-200" onChange={(e) => setKit({ ...kit, colors: kit.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)) })} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="font-mono text-xs text-ink-muted">{c.hex}</p>
                <p className="truncate text-xs text-ink-muted">{c.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Tipografia padrão</h2>
          <div className="card grid gap-3 p-4 sm:grid-cols-3">
            {(["heading", "body", "price"] as const).map((k) => (
              <Field key={k} label={{ heading: "Títulos", body: "Textos", price: "Preços" }[k]}>
                <select className="input" value={kit.fonts[k]} onChange={(e) => setKit({ ...kit, fonts: { ...kit.fonts, [k]: e.target.value } })} style={{ fontFamily: kit.fonts[k] }}>
                  {EDITOR_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Regras de aplicação da marca</h2>
          <textarea className="input min-h-[132px]" value={kit.rules} onChange={(e) => setKit({ ...kit, rules: e.target.value })} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Frases e chamadas aprovadas</h2>
        <p className="mb-3 text-sm text-ink-muted">Frases ficam disponíveis no gerador. Os <strong>selos de condição</strong> (ex.: “10x sem juros”) aparecem para ligar/desligar em cada flyer; sem nenhum cadastrado, valem os padrões: 10% OFF no PIX · 10x sem juros · Entrega para todo o Brasil.</p>
        <div className="card p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <select className="input sm:w-48" value={phrase.category} onChange={(e) => setPhrase({ ...phrase, category: e.target.value })}>
              <option value="geral">Geral</option>
              <option value="selo">Selo de condição (rodapé)</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className="input" placeholder="Ex.: Tecnologia que move o seu negócio" value={phrase.text} onChange={(e) => setPhrase({ ...phrase, text: e.target.value })} />
            <button className="btn-secondary" disabled={!phrase.text.trim()} onClick={() => { setKit({ ...kit, approvedPhrases: [...kit.approvedPhrases, { ...phrase, text: phrase.text.trim() }] }); setPhrase({ ...phrase, text: "" }); }}><Plus className="h-4 w-4" />Adicionar</button>
          </div>
          {kit.approvedPhrases.length === 0 ? <p className="text-sm text-ink-muted">Nenhuma frase cadastrada.</p> : (
            <ul className="divide-y divide-zinc-100">
              {kit.approvedPhrases.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="badge bg-brand-50 text-brand-700">{p.category === "geral" ? "Geral" : p.category === "selo" ? "Selo" : CATEGORIES.find((c) => c.key === p.category)?.label}</span>
                  <span className="flex-1">{p.text}</span>
                  <button className="btn-icon btn-ghost" aria-label="Remover frase" onClick={() => setKit({ ...kit, approvedPhrases: kit.approvedPhrases.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button className="btn-primary shadow-pop" onClick={() => save()} disabled={saving}>{saving && <Spinner />}Salvar cores, tipografia, regras e frases</button>
      </div>

      {(["mascot", "element"] as const).map((kind) => {
        const list = kind === "mascot" ? kit.mascots : kit.elements;
        return (
          <section key={kind}>
            <h2 className="text-lg font-semibold">{kind === "mascot" ? "Mascote oficial Digu" : "Elementos institucionais"}</h2>
            <p className="mb-3 text-sm text-ink-muted">
              {kind === "mascot" ? "Envie os arquivos oficiais do Digu (poses/variações). O sistema não gera nem altera o mascote; o usuário escolhe se o flyer terá ou não o Digu." : "Selos, ícones e grafismos oficiais que poderão ser inseridos no editor."}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((a) => (
                <div key={a.assetId} className="card group relative p-2">
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-zinc-50"><img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" /></div>
                  <p className="mt-1 truncate text-xs">{a.name}</p>
                  <button className="btn-icon absolute right-1 top-1 bg-surface/90 opacity-0 shadow group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${a.name}`} onClick={() => setRemoveAsset(a)}><Trash2 className="h-3.5 w-3.5 text-accent-600" /></button>
                </div>
              ))}
              <Dropzone compact accept={BRAND_ACCEPT} busy={uploading === kind} label={kind === "mascot" ? "Enviar arquivo do Digu" : "Enviar elemento"} onFiles={(f) => addAsset(f, kind)} />
            </div>
          </section>
        );
      })}

      <ConfirmDialog open={!!removeAsset} title="Remover do Brand Kit?" danger confirmLabel="Remover" message={<>“{removeAsset?.name}” deixará de estar disponível para novos flyers. Flyers já criados não são alterados.</>} onConfirm={confirmRemove} onCancel={() => setRemoveAsset(null)} />
    </div>
  );
}
