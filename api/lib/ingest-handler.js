// POST /api/ingest handler logic
// Receives sessions.json and upserts into Neon
// Note: No explicit transactions due to Neon serverless HTTP API limitations

async function ingestSessions(sql, payload) {
  const { sessions } = payload;

  if (!sessions || typeof sessions !== 'object') {
    return { error: 'Invalid payload: missing or invalid sessions object' };
  }

  let sessionsUpserted = 0;
  let logEntriesInserted = 0;
  let errors = [];

  try {
    for (const [sessionId, sessionData] of Object.entries(sessions)) {
      if (typeof sessionId !== 'string' || !sessionData || typeof sessionData !== 'object') {
        continue;
      }

      const {
        session_name,
        model,
        profile,
        started_at,
        last_activity_at,
        _state,
        log = [],
      } = sessionData;

      try {
        await sql`
          INSERT INTO sessions (
            session_id, session_name, model, profile, started_at,
            last_activity_at, state, updated_at
          ) VALUES (
            ${sessionId},
            ${session_name || null},
            ${model || null},
            ${profile || null},
            ${started_at || null},
            ${last_activity_at || null},
            ${_state ? JSON.stringify(_state) : null},
            NOW()
          )
          ON CONFLICT (session_id) DO UPDATE SET
            session_name = COALESCE(EXCLUDED.session_name, sessions.session_name),
            model = COALESCE(EXCLUDED.model, sessions.model),
            profile = COALESCE(EXCLUDED.profile, sessions.profile),
            started_at = COALESCE(EXCLUDED.started_at, sessions.started_at),
            last_activity_at = COALESCE(EXCLUDED.last_activity_at, sessions.last_activity_at),
            state = COALESCE(EXCLUDED.state, sessions.state),
            updated_at = NOW()
        `;
        sessionsUpserted++;
      } catch (e) {
        errors.push(`Failed to upsert session ${sessionId}: ${e.message}`);
        continue;
      }

      for (const entry of log) {
        if (!entry || typeof entry !== 'object' || !entry.at) {
          continue;
        }

        const {
          at,
          event = null,
          input_tokens = null,
          cache_read_tokens = null,
          cache_write_tokens = null,
          output_tokens = null,
          context_pct = null,
        } = entry;

        try {
          await sql`
            INSERT INTO log_entries (
              session_id, at, event, input_tokens, cache_read_tokens,
              cache_write_tokens, output_tokens, context_pct
            ) VALUES (
              ${sessionId},
              ${at},
              ${event},
              ${input_tokens},
              ${cache_read_tokens},
              ${cache_write_tokens},
              ${output_tokens},
              ${context_pct}
            )
            ON CONFLICT DO NOTHING
          `;
          logEntriesInserted++;
        } catch (e) {
          if (!e.message.includes('duplicate') && !e.message.includes('UNIQUE')) {
            errors.push(`Failed to insert log for ${sessionId} at ${at}: ${e.message}`);
          }
        }
      }
    }

    return {
      ok: true,
      sessions_upserted: sessionsUpserted,
      log_entries_inserted: logEntriesInserted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[ingest] Error:', error.message);
    return {
      error: `Database error: ${error.message}`,
      sessions_upserted: sessionsUpserted,
      log_entries_inserted: logEntriesInserted,
    };
  }
}

module.exports = { ingestSessions };
