import { redirect } from "next/navigation";

export default function HostIndexPage() {
  redirect("/host/games");
}