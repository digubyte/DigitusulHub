import { requirePageUser } from "@/core/auth/session";
import { UsersAdmin } from "./users-client";

export const metadata = { title: "Usuários" };

export default async function Page() {
  await requirePageUser("users.manage");
  return <UsersAdmin />;
}
