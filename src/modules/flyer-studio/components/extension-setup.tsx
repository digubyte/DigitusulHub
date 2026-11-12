"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Puzzle } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { detectChatCleaner, EXTENSION_ZIP } from "./chat-cleaner";

/** Passo a passo para instalar a extensão que apaga as conversas do ChatGPT ao aprovar. */
export function ExtensionSetup() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { detectChatCleaner().then(setOk); }, []);

  const steps = [
    <>Baixe a extensão e <strong>descompacte</strong> o arquivo numa pasta fixa (ex.: <code className="rounded bg-zinc-100 px-1">Documentos\Digitusul\extensao</code>). Não apague essa pasta depois.</>,
    <>No Chrome, abra <code className="rounded bg-zinc-100 px-1">chrome://extensions</code> (copie e cole na barra de endereço).</>,
    <>Ligue o <strong>Modo do desenvolvedor</strong>, no canto superior direito.</>,
    <>Clique em <strong>Carregar sem compactação</strong> e escolha a pasta que você descompactou.</>,
    <>Volte aqui e recarregue a página: o aviso abaixo fica verde.</>,
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Puzzle className="h-6 w-6" /></div>
        <div>
          <p className="eyebrow">Gerador de flyers</p>
          <h1 className="text-2xl font-semibold tracking-tight">Extensão do Chrome</h1>
          <p className="mt-1 text-sm text-zinc-500">Com ela, ao aprovar um flyer, a conversa usada no ChatGPT é apagada na hora. Ela só mexe nas conversas de flyers aprovados aqui no Hub.</p>
        </div>
      </div>

      <div className={ok ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" : "rounded-xl border border-zinc-200 bg-surface px-4 py-3 text-sm text-zinc-600"}>
        {ok === null ? <span className="flex items-center gap-2"><Spinner />Procurando a extensão neste Chrome…</span>
          : ok ? <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Extensão instalada e funcionando neste Chrome.</span>
          : <span>Extensão ainda não instalada neste Chrome.</span>}
      </div>

      <div className="card space-y-4 p-6">
        <a href={EXTENSION_ZIP} download className="btn-accent"><Download className="h-4 w-4" />Baixar a extensão (.zip)</a>
        <ol className="space-y-3 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
              <span className="pt-0.5 text-zinc-600">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-zinc-500">Funciona no Chrome em que estiver instalada e logada no ChatGPT. Em outros computadores, a tarefa agendada do Claude faz a limpeza.</p>
      </div>
      <Link href="/lote" className="text-sm text-zinc-500 hover:text-ink">← Voltar ao gerador</Link>
    </div>
  );
}
