"use client";
/** O canvas (Konva) depende do navegador: os componentes são carregados somente no cliente. */
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/primitives";

const Loading = () => <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-6 w-6 text-brand-600" /></div>;

export const WizardClient = dynamic(() => import("./wizard").then((m) => m.Wizard), { ssr: false, loading: Loading });
export const EditorClient = dynamic(() => import("./editor").then((m) => m.Editor), { ssr: false, loading: Loading });
