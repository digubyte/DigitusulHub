import "server-only";
import { db } from "@/core/db";

export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Entrou na plataforma",
  "auth.logout": "Saiu da plataforma",
  "auth.login_failed": "Tentativa de login falhou",
  "auth.password_reset": "Redefiniu a senha",
  "auth.password_changed": "Alterou a senha",
  "user.create": "Criou usuário",
  "user.update": "Atualizou usuário",
  "user.reset_link": "Gerou link de redefinição de senha",
  "module.update": "Alterou configuração de módulo",
  "brandkit.update": "Atualizou o Brand Kit",
  "brandasset.create": "Adicionou elemento ao Brand Kit",
  "brandasset.delete": "Removeu elemento do Brand Kit",
  "file.upload": "Enviou arquivo",
  "file.remove_bg": "Removeu fundo de imagem",
  "flyer.create": "Criou flyer",
  "flyer.update": "Salvou flyer",
  "flyer.duplicate": "Duplicou flyer",
  "flyer.delete": "Excluiu flyer",
  "flyer.export": "Exportou flyer",
  "flyer.template": "Alterou template salvo",
  "ai.compose": "Usou Criar com IA",
};

export async function logActivity(
  userId: string | null,
  action: string,
  entity?: { type: string; id: string } | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.activityLog.create({
      data: {
        userId,
        action,
        entityType: entity?.type,
        entityId: entity?.id,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (e) {
    console.error("[audit] falha ao registrar atividade", e);
  }
}
