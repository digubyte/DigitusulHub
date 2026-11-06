import { requirePageUser } from "@/core/auth/session";
import { getBrandKit } from "@/modules/flyer-studio/services/brand-service";
import { BrandKitAdmin } from "./brand-kit-client";

export const metadata = { title: "Brand Kit" };

export default async function Page() {
  await requirePageUser("brandkit.manage");
  return <BrandKitAdmin initial={await getBrandKit()} />;
}
