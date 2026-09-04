// Supabase Edge Function: handles OAuth callbacks and scheduled sync for
// two SEPARATE Google connections — the legacy Fitness API (steps/calories,
// provider 'google_fit') and the new Google Health API (workouts/sleep,
// provider 'google_health'). These can't share one OAuth grant: the Health
// API rejects any access token that also carries a legacy Fitness scope
// ("disallowed_scopes" error), so each needs its own consent flow and its
// own refresh token.
//
// Routes (path is relative to the function's base URL):
//   GET  /google-fit-sync/callback?code=...&state=<base64 JSON>  -> OAuth token exchange
//   POST /google-fit-sync/sync                                    -> refresh + pull latest data
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

type Provider = 'google_fit' | 'google_health';

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

const ALLOWED_RETURN_ORIGINS = [
  'https://superunrelated.github.io',
  'http://localhost:4200',
];

async function handleOAuthCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  if (!code || !stateRaw) return json({ error: 'missing code or state' }, 400);

  let userId: string;
  let returnTo: string;
  let provider: Provider;
  try {
    const decoded = JSON.parse(atob(stateRaw)) as {
      userId: string;
      returnTo: string;
      provider: Provider;
    };
    userId = decoded.userId;
    returnTo = decoded.returnTo;
    provider = decoded.provider;
    if (
      !userId ||
      !ALLOWED_RETURN_ORIGINS.some((origin) => returnTo.startsWith(origin)) ||
      (provider !== 'google_fit' && provider !== 'google_health')
    ) {
      throw new Error('invalid state contents');
    }
  } catch {
    return json({ error: 'invalid state' }, 400);
  }

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

  const secretName = `${provider}_refresh_token_${userId}`;
  const { data: secretId, error: vaultError } = await admin.rpc(
    'vault_upsert_secret',
    { p_name: secretName, p_secret: tokens.refresh_token },
  );
  if (vaultError) throw vaultError;

  const { error: upsertError } = await admin
    .from('wearable_connections')
    .upsert(
      {
        user_id: userId,
        provider,
        refresh_token_secret_id: secretId,
        last_synced_at: null,
      },
      { onConflict: 'user_id,provider' },
    );
  if (upsertError) throw upsertError;

  return new Response(null, {
    status: 302,
    headers: { Location: `${returnTo}?connected=${provider}` },
  });
}

async function handleSync(userId?: string): Promise<Response> {
  let query = admin.from('wearable_connections').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data: connections, error } = await query;
  if (error) throw error;

  const results = [];
  for (const connection of connections ?? []) {
    const refreshToken = await readRefreshToken(
      connection.refresh_token_secret_id,
    );
    const accessToken = await refreshAccessToken(refreshToken);
    if (!accessToken.ok) {
      results.push({
        user_id: connection.user_id,
        provider: connection.provider,
        ok: false,
        error: accessToken.error,
      });
      continue;
    }

    const result =
      connection.provider === 'google_fit'
        ? await syncLegacyFitness(connection.user_id, accessToken.token)
        : await syncGoogleHealth(connection.user_id, accessToken.token);

    await admin
      .from('wearable_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', connection.user_id)
      .eq('provider', connection.provider);

    results.push({
      user_id: connection.user_id,
      provider: connection.provider,
      ok: true,
      ...result,
    });
  }
  return json({ synced: results.length, results });
}

async function readRefreshToken(secretId: string): Promise<string> {
  const { data, error } = await admin.rpc('vault_read_secret', {
    p_id: secretId,
  });
  if (error) throw error;
  return data as string;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const { access_token } = (await res.json()) as { access_token: string };
  return { ok: true, token: access_token };
}

async function syncLegacyFitness(userId: string, accessToken: string) {
  const now = Date.now();
  const startTimeMillis = now - 7 * 24 * 60 * 60 * 1000; // last 7 days
  const aggregateRes = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    return { error: await aggregateRes.text() };
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
      user_id: userId,
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

  return { days_synced: rows.length };
}

// The Google Health API is the Fitness API's replacement (rollout started
// May 2026, legacy API sunsetting end of 2026). Docs: https://developers.google.com/health
async function syncGoogleHealth(userId: string, accessToken: string) {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [exercisePoints, sleepPoints] = await Promise.all([
    listHealthDataPoints(
      accessToken,
      'exercise',
      start.toISOString(),
      now.toISOString(),
    ),
    listHealthDataPoints(
      accessToken,
      'sleep',
      start.toISOString(),
      now.toISOString(),
    ),
  ]);

  const workouts = exercisePoints
    .filter((p) => p.interval?.startTime && p.interval?.endTime)
    .map((p) => ({
      user_id: userId,
      started_at: p.interval.startTime,
      ended_at: p.interval.endTime,
      activity_type: (p.exerciseType ?? 'unknown').toLowerCase(),
      source: 'google_health',
    }));

  const sleepSessions = sleepPoints
    .filter((p) => p.interval?.startTime && p.interval?.endTime)
    .map((p) => {
      const start = new Date(p.interval.startTime).getTime();
      const end = new Date(p.interval.endTime).getTime();
      return {
        user_id: userId,
        started_at: p.interval.startTime,
        ended_at: p.interval.endTime,
        duration_minutes: Math.round((end - start) / 60_000),
        source: 'google_health',
      };
    });

  if (workouts.length > 0) {
    const { error } = await admin
      .from('workouts')
      .upsert(workouts, { onConflict: 'user_id,started_at,source' });
    if (error) throw error;
  }
  if (sleepSessions.length > 0) {
    const { error } = await admin
      .from('sleep_sessions')
      .upsert(sleepSessions, { onConflict: 'user_id,started_at,source' });
    if (error) throw error;
  }

  return {
    workouts_synced: workouts.length,
    sleep_sessions_synced: sleepSessions.length,
  };
}

interface HealthDataPoint {
  interval?: { startTime: string; endTime: string };
  exerciseType?: string;
}

async function listHealthDataPoints(
  accessToken: string,
  dataType: 'exercise' | 'sleep',
  startTimeIso: string,
  endTimeIso: string,
): Promise<HealthDataPoint[]> {
  const points: HealthDataPoint[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: '25',
      filter: `${dataType}.interval.start_time>="${startTimeIso}" AND ${dataType}.interval.end_time<"${endTimeIso}"`,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      console.error(
        `Health API ${dataType} fetch failed`,
        res.status,
        await res.text(),
      );
      return points;
    }
    const body = (await res.json()) as {
      dataPoints?: HealthDataPoint[];
      nextPageToken?: string;
    };
    points.push(...(body.dataPoints ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return points;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
