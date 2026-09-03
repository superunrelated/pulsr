#!/usr/bin/env node
// Pulsr MCP server: exposes health/lifestyle data as read-only MCP tools so
// any MCP client (Claude Desktop, Claude Code) can query it and reason about
// it. This server never calls an LLM itself — it is purely a data bridge.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { daysAgoIso, supabase } from './supabase.js';

const server = new McpServer({ name: 'pulsr', version: '0.1.0' });

server.registerTool(
  'get_recent_activity',
  {
    title: 'Get recent activity',
    description:
      'Steps, active minutes, calories, workouts and sleep for the last N days.',
    inputSchema: { days: z.number().int().min(1).max(90).default(7) },
  },
  async ({ days }) => {
    const since = daysAgoIso(days);
    const [activity, workouts, sleep] = await Promise.all([
      supabase
        .from('daily_activity')
        .select('*')
        .gte('date', since.slice(0, 10))
        .order('date'),
      supabase
        .from('workouts')
        .select('*')
        .gte('started_at', since)
        .order('started_at'),
      supabase
        .from('sleep_sessions')
        .select('*')
        .gte('started_at', since)
        .order('started_at'),
    ]);
    return textResult({
      daily_activity: activity.data ?? [],
      workouts: workouts.data ?? [],
      sleep_sessions: sleep.data ?? [],
    });
  },
);

server.registerTool(
  'get_weight_trend',
  {
    title: 'Get weight trend',
    description: 'Weight log entries (kg) for the last N days, oldest first.',
    inputSchema: { days: z.number().int().min(1).max(365).default(30) },
  },
  async ({ days }) => {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .gte('logged_at', daysAgoIso(days))
      .order('logged_at');
    if (error) throw error;
    return textResult(data);
  },
);

server.registerTool(
  'get_medication_adherence',
  {
    title: 'Get medication adherence',
    description:
      'Medications and their scheduled/taken/skipped logs for the last N days.',
    inputSchema: { days: z.number().int().min(1).max(90).default(14) },
  },
  async ({ days }) => {
    const [meds, logs] = await Promise.all([
      supabase.from('medications').select('*').eq('active', true),
      supabase
        .from('medication_logs')
        .select('*')
        .gte('scheduled_for', daysAgoIso(days))
        .order('scheduled_for'),
    ]);
    if (meds.error) throw meds.error;
    if (logs.error) throw logs.error;
    return textResult({ medications: meds.data, logs: logs.data });
  },
);

server.registerTool(
  'get_symptom_log',
  {
    title: 'Get symptom log',
    description:
      'Free-text symptom/condition entries with severity for the last N days.',
    inputSchema: { days: z.number().int().min(1).max(180).default(30) },
  },
  async ({ days }) => {
    const { data, error } = await supabase
      .from('symptom_logs')
      .select('*')
      .gte('logged_at', daysAgoIso(days))
      .order('logged_at');
    if (error) throw error;
    return textResult(data);
  },
);

server.registerTool(
  'get_daily_summary',
  {
    title: 'Get daily summary',
    description:
      'A combined snapshot for a single date (YYYY-MM-DD): activity, weight, meds, symptoms.',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
  },
  async ({ date }) => {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    const [activity, weight, medLogs, symptoms] = await Promise.all([
      supabase
        .from('daily_activity')
        .select('*')
        .eq('date', date)
        .maybeSingle(),
      supabase
        .from('weight_logs')
        .select('*')
        .gte('logged_at', dayStart)
        .lte('logged_at', dayEnd),
      supabase
        .from('medication_logs')
        .select('*')
        .gte('scheduled_for', dayStart)
        .lte('scheduled_for', dayEnd),
      supabase
        .from('symptom_logs')
        .select('*')
        .gte('logged_at', dayStart)
        .lte('logged_at', dayEnd),
    ]);
    return textResult({
      date,
      activity: activity.data,
      weight_logs: weight.data ?? [],
      medication_logs: medLogs.data ?? [],
      symptom_logs: symptoms.data ?? [],
    });
  },
);

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
