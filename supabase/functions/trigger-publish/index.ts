// Déclenche manuellement le workflow GitHub Actions "Publier les
// emplacements photo" (.github/workflows/publish-media.yml), sans
// attendre son prochain passage programmé (toutes les 15 min).
//
// Le token GitHub (secret GITHUB_DISPATCH_TOKEN) ne doit JAMAIS être
// exposé côté navigateur : cette fonction sert d'intermédiaire, appelée
// depuis /gestion avec la session de l'admin déjà connectée, vérifiée ici
// via l5d2lm_can_admin() avant tout appel à l'API GitHub.
//
// Déploiement : Supabase Dashboard > Edge Functions > New function
// ("trigger-publish") > coller ce fichier > Deploy. Nécessite au
// préalable le secret GITHUB_DISPATCH_TOKEN (Dashboard > Edge Functions
// > Secrets) : un jeton GitHub "fine-grained", limité au dépôt
// toopil/l5d2lm-site, permission "Actions: Read and write" uniquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GITHUB_OWNER = 'toopil';
const GITHUB_REPO = 'l5d2lm-site';
const GITHUB_WORKFLOW_FILE = 'publish-media.yml';
const GITHUB_REF = 'main';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Non authentifié.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: canAdmin, error: rpcError } = await supabase.rpc('l5d2lm_can_admin');
  if (rpcError || canAdmin !== true) {
    return jsonResponse({ error: 'Accès refusé : administrateur L5D2LM avec MFA validé requis.' }, 403);
  }

  const githubToken = Deno.env.get('GITHUB_DISPATCH_TOKEN');
  if (!githubToken) {
    return jsonResponse({ error: 'Configuration incomplète : secret GITHUB_DISPATCH_TOKEN manquant côté Supabase.' }, 500);
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: GITHUB_REF }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    return jsonResponse({ error: `GitHub a refusé la demande (${response.status}) : ${detail}` }, 502);
  }

  return jsonResponse({ ok: true });
});
