// ============================================================================
//  Edge Function: recuperar-password-cliente
//  Recuperação de password para CLIENTES do Portal — como o "email de login"
//  deles é técnico (baseado no NIF, nunca visto pelo cliente), o mecanismo
//  normal de "esqueci-me da password" da Supabase não serve (mandaria o link
//  para um endereço que não existe).
//
//  Em vez disso, este fluxo pede NIF + o email REAL registado na ficha do
//  cliente. Só se os dois baterem certo com o mesmo cliente é que se gera um
//  link de recuperação (via Admin API da Supabase) e se envia esse link para
//  o email real do cliente, através da função de email já existente
//  ("super-function").
//
//  Deploy (painel Supabase):
//   Edge Functions > recuperar-password-cliente > Code > colar isto > Deploy.
//   (Pode ficar com "Verify JWT" DESLIGADO — é chamada antes do login.)
//
//  Body esperado: { nif, email }
//
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function emailFantasmaCliente(nif, adminId) {
  const limpo = String(nif || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const empresaCurta = String(adminId || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return limpo + (empresaCurta ? "." + empresaCurta : "") + "@clientes.totalgest.pt";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ erro: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados." }, 500);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const nif = String(body.nif || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!nif || !email) return json({ erro: "Faltam dados (nif, email)." }, 400);

    // Resposta genérica em qualquer caso de "não encontrado", para nunca revelar
    // a quem está a tentar adivinhar se um NIF/email existe ou não no sistema.
    const respostaGenerica = { ok: true, mensagem: "Se o NIF e o email indicados corresponderem a um cliente com Portal ativo, foi enviado um link de recuperação para esse email." };

    const { data: candidatos, error: errCliente } = await supabase
      .from("clientes")
      .select("id, nome, email, nif, admin_id, portal_ativo")
      .eq("nif", nif);
    if (errCliente) throw errCliente;
    // O mesmo NIF pode existir como cliente em mais que uma empresa — encontra a(s) que
    // tem Portal ativo E o email bate certo com o indicado.
    const cliente = (candidatos || []).find(
      (c) => c.portal_ativo && c.email && c.email.toLowerCase() === email
    );
    if (!cliente) {
      return json(respostaGenerica);
    }

    const emailTecnico = emailFantasmaCliente(nif, cliente.admin_id);
    const { data: linkData, error: errLink } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: emailTecnico,
      options: { redirectTo: "https://www.totalgest.pt/redefinir-password.html" },
    });
    if (errLink || !linkData?.properties?.action_link) {
      console.error("Erro ao gerar link de recuperação:", errLink);
      return json(respostaGenerica); // não revela o erro real ao cliente, só regista para diagnóstico
    }

    try {
      const envio = await fetch(`${SUPABASE_URL}/functions/v1/super-function`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          tipo: "recuperar_password",
          to_email: cliente.email,
          to_name: cliente.nome,
          link_confirmacao: linkData.properties.action_link,
        }),
      });
      if (!envio.ok) console.error("Falha no envio de recuperação: HTTP", envio.status);
    } catch (e) {
      console.error("Falha ao enviar email de recuperação:", e);
    }

    return json(respostaGenerica);
  } catch (e) {
    console.error("Erro em recuperar-password-cliente:", e);
    return json({ erro: String(e && e.message ? e.message : e) }, 500);
  }
});
