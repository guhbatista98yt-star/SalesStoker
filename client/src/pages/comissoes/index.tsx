import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";
import VendedorView from "./vendedor";
import GestorView from "./gestor";

export default function Comissoes() {
  const { user } = useAuth();
  const role = user?.role;
  if (role === "vendedor") return <VendedorView />;
  if (role === "admin" || role === "supervisor") return <GestorView />;
  return <Redirect to="/" />;
}
