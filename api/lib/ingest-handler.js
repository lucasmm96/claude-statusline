// POST /api/ingest handler logic
// Receives sessions.json (or delta) and upserts into Neon via batched transactions

const CHUNK = 500;

async function ingestSessions(sql, payload) {
  const { sessions } = payload;

  if (!sessions || typeof sessions !== 'object') {
    return { error: 'Invalid payload: missing or invalid sessions object' };
  }

  const sessionEntries = Object.entries(sessions).filter(
    ([id, data]) => typeof id === 'string' && data && typeof data === 'object'
  );

  if (sessionEntries.length === 0) {
    return { ok: true, sessions_upserted: 0, log_entries_inserted: 0 };
  }

  const errors = [];

  try {
    // Upsert all sessions in one batched transaction
    await sql.transaction(
      sessionEntries.map(([sessionId, s]) => sql`
        INSERT INTO sessions (
          session_id, session_name, model, profile, started_at,
          last_activity_at, state, updated_at
        ) VALUES (
          ${sessionId},
          ${s.session_name || null},
          ${s.model || null},
          ${s.profile || null},
          ${s.started_at || null},
          ${s.last_activity_at || null},
          ${s._state ? JSON.stringify(s._state) : null},
          NOW()
        )
        ON CONFLICT (session_id) DO UPDATE SET
          session_name      = COALESCE(EXCLUDED.session_name, sessions.session_name),
          model             = COALESCE(EXCLUDED.model, sessions.model),
          profile           = COALESCE(EXCLUDED.profile, sessions.profile),
          started_at        = COALESCE(EXCLUDED.started_at, sessions.started_at),
          last_activity_at  = COALESCE(EXCLUDED.last_activity_at, sessions.last_activity_at),
          state             = COALESCE(EXCLUDED.state, sessions.state),
          updated_at        = NOW()
      `)
    );

    // Collect all log entries
    const allEntries = [];
    for (const [sessionId, s] of sessionEntries) {
      for (const e of s.log || []) {
        if (!e || !e.at) continue;
        allEntries.push({
          session_id:        sessionId,
          at:                e.at,
          event:             e.event             ?? null,
          input_tokens:      e.input_tokens      ?? null,
          cache_read_tokens: e.cache_read_tokens ?? null,
          cache_write_tokens:e.cache_write_tokens?? null,
          output_tokens:     e.output_tokens     ?? null,
          context_pct:       e.context_pct       ?? null,
          model:             e.model             ?? null,
        });
      }
    }

    // Insert log entries in chunks to stay within Neon batch limits
    let logEntriesInserted = 0;
    for (let i = 0; i < allEntries.length; i += CHUNK) {
      const chunk = allEntries.slice(i, i + CHUNK);
      try {
        await sql.transaction(
          chunk.map(e => sql`
            INSERT INTO log_entries (
              session_id, at, event, input_tokens, cache_read_tokens,
              cache_write_tokens, output_tokens, context_pct, model
            ) VALUES (
              ${e.session_id}, ${e.at}, ${e.event},
              ${e.input_tokens}, ${e.cache_read_tokens},
              ${e.cache_write_tokens}, ${e.output_tokens}, ${e.context_pct},
              ${e.model}
            )
            ON CONFLICT (session_id, at, COALESCE(event, ''))
            DO UPDATE SET model = COALESCE(EXCLUDED.model, log_entries.model)
          `)
        );
        logEntriesInserted += chunk.length;
      } catch (e) {
        errors.push(`log batch ${i}–${i + chunk.length}: ${e.message}`);
      }
    }

    return {
      ok: true,
      sessions_upserted: sessionEntries.length,
      log_entries_inserted: logEntriesInserted,
      ...(errors.length > 0 && { errors }),
    };
  } catch (error) {
    console.error('[ingest] Error:', error.message);
    return { error: `Database error: ${error.message}` };
  }
}

module.exports = { ingestSessions };
