// Supabase Edge Function: handles the Google Fit OAuth callback and the
// scheduled sync of steps/workouts/sleep into Pulsr's tables.
//
// Routes (path is relative to the function's base URL):
//   GET  /google-fit-sync/callback?code=...&state=<user_id>  -> OAuth token exchange
//   POST /google-fit-sync/sync                                -> refresh + pull latest data
//     body: { user_id: string }  (omit to sync every connected user, used by the cron trigger)
//
// Required Edge Function secrets (set via `supabase secrets set`):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isRateLimited } from '../_shared/rate-limit.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (isRateLimited(url.pathname, { maxHits: 30, windowMs: 60_000 })) {
    return json({ error: 'rate limited' }, 429);
  }

  try {
    if (req.method === 'GET' && url.pathname.endsWith('/callback')) {
      return await handleOAuthCallback(url);
    }
    if (req.method === 'POST' && url.pathname.endsWith('/sync')) {
      const body = await req.json().catch(() => ({}));
      return await handleSync(body.user_id as string | undefined);
    }
    return json({ error: 'not found' }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: 'internal error' }, 500);
  }
});

async function handleOAuthCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state'); // set to the signed-in user's id when redirecting to Google
  if (!code || !userId) return json({ error: 'missing code or state' }, 400);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    return json(
      { error: 'token exchange failed', detail: await tokenRes.text() },
      400,
    );
  }
  const tokens = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token: string;
  };
  if (!tokens.refresh_token) {
    return json(
      { error: 'no refresh_token returned — revoke prior grant and reconnect' },
      400,
    );
  }

  const secretName = `google_fit_refresh_token_${userId}`;
  const { data: secretId, error: vaultError } = await admin.rpc(
    'vault_upsert_secret',
    {
      p_name: secretName,
      p_secret: tokens.refresh_token,
    },
  );
  if (vaultError) throw vaultError;

  const { error: upsertError } = await admin
    .from('wearable_connections')
    .upsert(
      {
        user_id: userId,
        provider: 'google_fit',
        refresh_token_secret_id: secretId,
        last_synced_at: null,
      },
      { onConflict: 'user_id,provider' },
    );
  if (upsertError) throw upsertError;

  return new Response(null, {
    status: 302,
    headers: { Location: '/settings/wearables?connected=google_fit' },
  });
}

async function handleSync(userId?: string): Promise<Response> {
  let query = admin
    .from('wearable_connections')
    .select('*')
    .eq('provider', 'google_fit');
  if (userId) query = query.eq('user_id', userId);
  const { data: connections, error } = await query;
  if (error) throw error;

  const results = [];
  for (const connection of connections ?? []) {
    results.push(await syncConnection(connection));
  }
  return json({ synced: results.length, results });
}

async function syncConnection(connection: {
  user_id: string;
  refresh_token_secret_id: string;
}) {
  const { data: refreshToken, error: secretError } = await admin.rpc(
    'vault_read_secret',
    { p_id: connection.refresh_token_secret_id },
  );
  if (secretError) throw secretError;

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!refreshRes.ok) {
    return {
      user_id: connection.user_id,
      ok: false,
      error: await refreshRes.text(),
    };
  }
  const { access_token } = (await refreshRes.json()) as {
    access_token: string;
  };

  const now = Date.now();
  const startTimeMillis = now - 7 * 24 * 60 * 60 * 1000; // last 7 days
  const aggregateRes = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.active_minutes' },
          { dataTypeName: 'com.google.calories.expended' },
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis,
        endTimeMillis: now,
      }),
    },
  );
  if (!aggregateRes.ok) {
    return {
      user_id: connection.user_id,
      ok: false,
      error: await aggregateRes.text(),
    };
  }
  const aggregate = await aggregateRes.json();

  const rows = (aggregate.bucket ?? []).map((bucket: any) => {
    const date = new Date(Number(bucket.startTimeMillis))
      .toISOString()
      .slice(0, 10);
    const sum = (datasetIndex: number) =>
      bucket.dataset[datasetIndex]?.point?.reduce(
        (acc: number, p: any) =>
          acc + (p.value?.[0]?.intVal ?? p.value?.[0]?.fpVal ?? 0),
        0,
      ) ?? 0;
    return {
      user_id: connection.user_id,
      date,
      steps: Math.round(sum(0)),
      active_minutes: Math.round(sum(1)),
      calories: Math.round(sum(2)),
      source: 'google_fit',
    };
  });

  if (rows.length > 0) {
    const { error: upsertError } = await admin
      .from('daily_activity')
      .upsert(rows, { onConflict: 'user_id,date,source' });
    if (upsertError) throw upsertError;
  }

  const { workouts, sleepSessions } = await fetchSessions(
    access_token,
    startTimeMillis,
    now,
  );

  if (workouts.length > 0) {
    const { error: workoutsError } = await admin.from('workouts').upsert(
      workouts.map((w) => ({ ...w, user_id: connection.user_id })),
      { onConflict: 'user_id,started_at,source' },
    );
    if (workoutsError) throw workoutsError;
  }

  if (sleepSessions.length > 0) {
    const { error: sleepError } = await admin.from('sleep_sessions').upsert(
      sleepSessions.map((s) => ({ ...s, user_id: connection.user_id })),
      { onConflict: 'user_id,started_at,source' },
    );
    if (sleepError) throw sleepError;
  }

  await admin
    .from('wearable_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', connection.user_id)
    .eq('provider', 'google_fit');

  return {
    user_id: connection.user_id,
    ok: true,
    days_synced: rows.length,
    workouts_synced: workouts.length,
    sleep_sessions_synced: sleepSessions.length,
  };
}

// Google Fit activity type codes that represent sleep (general "Sleep" plus
// the granular sleep-stage types the newer Sleep API reports).
const SLEEP_ACTIVITY_TYPES = new Set([72, 109, 110, 111, 112, 121]);

const ACTIVITY_TYPE_NAMES: Record<number, string> = {
  7: 'walking',
  8: 'running',
  1: 'biking',
  9: 'aerobics',
  10: 'badminton',
  82: 'swimming',
  57: 'strength training',
  108: 'yoga',
  119: 'hiit',
};

interface FitSession {
  id: string;
  startTimeMillis: string;
  endTimeMillis: string;
  activityType?: number;
}

async function fetchSessions(
  accessToken: string,
  startTimeMillis: number,
  endTimeMillis: number,
): Promise<{
  workouts: {
    started_at: string;
    ended_at: string;
    activity_type: string;
    source: string;
  }[];
  sleepSessions: {
    started_at: string;
    ended_at: string;
    duration_minutes: number;
    source: string;
  }[];
  debug?: unknown;
}> {
  const params = new URLSearchParams({
    startTime: new Date(startTimeMillis).toISOString(),
    endTime: new Date(endTimeMillis).toISOString(),
  });
  const res = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error('sessions fetch failed', errText);
    return {
      workouts: [],
      sleepSessions: [],
      debug: { status: res.status, errText },
    };
  }
  const body = (await res.json()) as { session?: FitSession[] };
  const { session = [] } = body;

  const workouts = [];
  const sleepSessions = [];
  for (const s of session) {
    const startedAt = new Date(Number(s.startTimeMillis)).toISOString();
    const endedAt = new Date(Number(s.endTimeMillis)).toISOString();
    if (s.activityType != null && SLEEP_ACTIVITY_TYPES.has(s.activityType)) {
      const durationMinutes = Math.round(
        (Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60_000,
      );
      sleepSessions.push({
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        source: 'google_fit',
      });
    } else {
      workouts.push({
        started_at: startedAt,
        ended_at: endedAt,
        activity_type:
          ACTIVITY_TYPE_NAMES[s.activityType ?? -1] ??
          `type_${s.activityType ?? 'unknown'}`,
        source: 'google_fit',
      });
    }
  }
  return {
    workouts,
    sleepSessions,
    debug: { rawSessionCount: session.length },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
