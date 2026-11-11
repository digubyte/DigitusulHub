import type { PermissionKey } from "@/core/permissions";

/**
 * Registro de módulos da plataforma.
 *
 * Para adicionar um módulo:
 *  1. adicione um manifesto aqui;
 *  2. crie a rota em src/app/(hub)/<rota>;
 *  3. cadastre permissões em src/core/permissions.ts e rode `npm run db:seed`.
 * Status, ordem e visibilidade são ajustados pelo Administrador (tabela Module)
 * sem alteração de código.
 */
export type ModuleStatus = "active" | "development" | "disabled";
export type ModuleSection = "main" | "system";

export interface ModuleManifest {
  key: string;
  name: string;
  description: string;
  icon: string; // nome do ícone (ver components/layout/icons.tsx)
  route: string;
  section: ModuleSection;
  defaultStatus: ModuleStatus;
  defaultOrder: number;
  permission: PermissionKey;
  showOnDashboard: boolean;
}

export const MODULES: ModuleManifest[] = [
  { key: "inicio", name: "Início", description: "Todas as soluções da Digitusul", icon: "LayoutDashboard", route: "/inicio", section: "main", defaultStatus: "active", defaultOrder: 0, permission: "hub.access", showOnDashboard: false },
  { key: "flyers", name: "Gerador de flyers", description: "Monte o lote do dia, chame o Claude para criar as artes e aprove os flyers.", icon: "Palette", route: "/lote", section: "main", defaultStatus: "active", defaultOrder: 10, permission: "flyers.access", showOnDashboard: true },
  { key: "comercial", name: "Gestão Comercial", description: "Metas, vendas, produtividade e indicadores.", icon: "TrendingUp", route: "/modulos/comercial", section: "main", defaultStatus: "development", defaultOrder: 20, permission: "hub.access", showOnDashboard: true },
  { key: "crm", name: "CRM e Reativação", description: "Carteira, contatos e reativação de clientes.", icon: "Users", route: "/modulos/crm", section: "main", defaultStatus: "development", defaultOrder: 30, permission: "hub.access", showOnDashboard: true },
  { key: "marketing", name: "Marketing e Campanhas", description: "Campanhas, calendário e produção de conteúdo.", icon: "Megaphone", route: "/modulos/marketing", section: "main", defaultStatus: "development", defaultOrder: 40, permission: "hub.access", showOnDashboard: true },
  { key: "relatorios", name: "Relatórios", description: "Análises e painéis gerenciais.", icon: "BarChart3", route: "/modulos/relatorios", section: "main", defaultStatus: "development", defaultOrder: 50, permission: "hub.access", showOnDashboard: true },
  { key: "configuracoes", name: "Configurações", description: "Perfil, senha e preferências.", icon: "Settings", route: "/configuracoes", section: "system", defaultStatus: "active", defaultOrder: 90, permission: "hub.access", showOnDashboard: false },
  { key: "admin", name: "Administração", description: "Usuários, soluções, Brand Kit e integrações.", icon: "ShieldCheck", route: "/admin", section: "system", defaultStatus: "active", defaultOrder: 100, permission: "users.manage", showOnDashboard: false },
];

export function getManifest(key: string) {
  return MODULES.find((m) => m.key === key);
}

/** Módulos de núcleo — não podem ser desativados. */
export const CORE_MODULES = new Set(["inicio", "configuracoes", "admin"]);
