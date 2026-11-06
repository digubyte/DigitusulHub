"use client";
import { useState } from "react";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { api, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { applyPricingRule, describeRule, type PricingRule } from "@/modules/flyer-studio/domain/pricing";
import { formatPrice, parsePriceInput } from "@/modules/flyer-studio/domain/product-format";

export function IntegrationsAdmin({ items, pricing }: { items: { name: string; env: string; ok: boolean; detail: string }[]; pricing: PricingRule }) {
  const toast = useToast();
  const [rule, setRule] = useState(pricing);
  const [pct, setPct] = useState((pricing.markupBps / 100).toString().replace(".", ","));
  const [sample, setSample] = useState("785,50");
  const [busy, setBusy] = useState(false);
  const sampleCents = parsePriceInput(sample);

  async function save() {
    const bps = Math.round(Number(pct.replace(",", ".")) * 100);
    if (!Number.isFinite(bps) || bps < 0 || bps > 10000) return toast.error("Informe um percentual entre 0 e 100.");
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", json: { ...rule, markupBps: bps } });
      setRule({ ...rule, markupBps: bps });
      toast.success("Regra de preço salva.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const preview = { ...rule, markupBps: Math.round(Number(pct.replace(",", ".")) * 100) || 0 };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Integrações</h2>
        <p className="mb-3 text-sm text-ink-muted">As credenciais são lidas somente no servidor (arquivo <code>.env</code>) e nunca são expostas no navegador.</p>
        <div className="card divide-y divide-zinc-100">
          {items.map((i) => (
            <div key={i.name} className="flex items-start gap-3 p-4">
              {i.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <CircleSlash className="mt-0.5 h-5 w-5 text-zinc-400" />}
              <div className="flex-1">
                <p className="font-semibold">{i.name} <span className={`badge ml-1 ${i.ok ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{i.ok ? "Configurado" : "Indisponível"}</span></p>
                <p className="text-sm text-ink-muted">{i.detail}</p>
              </div>
              <code className="hidden text-xs text-ink-muted sm:block">{i.env}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Regra de preço do Estúdio</h2>
        <p className="mb-3 max-w-3xl text-sm text-ink-muted">Aplicada a produtos importados do catálogo do site ou lidos de imagens: o valor PIX nunca é usado; o valor final é calculado pelo sistema a partir do valor no cartão. Preços digitados manualmente são usados como informados.</p>
        <div className="card grid gap-4 p-4 md:grid-cols-[1fr_1fr_1fr_1.2fr]">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.markupEnabled} onChange={(e) => setRule({ ...rule, markupEnabled: e.target.checked })} />Aplicar acréscimo sobre o valor no cartão</label>
          <Field label="Acréscimo (%)"><input className="input" inputMode="decimal" value={pct} disabled={!rule.markupEnabled} onChange={(e) => setPct(e.target.value)} /></Field>
          <Field label="Arredondamento">
            <select className="input" value={rule.rounding} disabled={!rule.markupEnabled} onChange={(e) => setRule({ ...rule, rounding: e.target.value as PricingRule["rounding"] })}>
              <option value="psychological">Final comercial (,50 ,75 ,90 ,95 ,99)</option>
              <option value="cents">Duas casas decimais</option>
            </select>
          </Field>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <Field label="Simular valor no cartão"><input className="input" value={sample} onChange={(e) => setSample(e.target.value)} /></Field>
            <p className="mt-2">Valor final: <strong className="text-brand-700">{sampleCents ? formatPrice(applyPricingRule(sampleCents, preview)) : "—"}</strong></p>
            <p className="text-xs text-ink-muted">{describeRule(preview)}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Salvar regra</button></div>
      </section>
    </div>
  );
}
