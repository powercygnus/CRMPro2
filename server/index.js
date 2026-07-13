import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

// ============================================================
// PostgreSQL pool — rewrite direct host → session pooler
// ============================================================

/**
 * Supabase blocks direct TCP to db.<project>.supabase.co:5432 from Replit.
 * Rewrite the URL to the session pooler:
 *   host    → aws-0-ap-northeast-1.pooler.supabase.com
 *   port    → 6543
 *   user    → postgres.<project-id>   (required by pooler)
 */
function buildPoolerUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    // Extract project id from hostname: db.<id>.supabase.co
    const match = u.hostname.match(/^db\.(.+)\.supabase\.co$/);
    const projectId = match ? match[1] : u.hostname.split('.')[1];
    u.hostname = 'aws-0-ap-northeast-1.pooler.supabase.com';
    u.port     = '6543';
    u.username = `postgres.${projectId}`;
    return u.toString();
  } catch (err) {
    console.error('[DB] Failed to rewrite SUPABASE_DB_URL:', err.message);
    return null;
  }
}

const rawDbUrl   = process.env.SUPABASE_DB_URL || '';
const poolerUrl  = buildPoolerUrl(rawDbUrl);

let pool = null;
if (poolerUrl) {
  pool = new Pool({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => console.error('[DB] Unexpected pool error:', err.message));
  console.log('[DB] PostgreSQL pool → session pooler (6543)');
} else {
  console.warn('[DB] SUPABASE_DB_URL not set — password-reset routes will be disabled.');
}

/** Run a parameterised query, return rows. */
async function dbQuery(text, params = []) {
  if (!pool) throw new Error('DB pool not configured.');
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

const app = express();

// ============================================================
// Dynamic CORS Configuration
// ============================================================

/**
 * Check if origin is a valid WebContainer/Bolt preview domain.
 * Matches patterns like: https://abc123--name--username.webcontainer-api.io
 */
function isWebContainerOrigin(origin) {
  try {
    const url = new URL(origin);
    // Match webcontainer-api.io subdomains
    return /\.webcontainer-api\.io$/.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Check if origin is a Replit dev/preview domain.
 * Matches patterns like: https://<repl-name>.<username>.repl.co
 * or https://<id>-<port>.replit.dev
 */
function isReplitOrigin(origin) {
  try {
    const url = new URL(origin);
    return /\.repl\.co$/.test(url.hostname) || /\.replit\.dev$/.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Get the list of allowed origins dynamically.
 */
function getAllowedOrigins() {
  const origins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5001',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5001',
    'http://127.0.0.1:8080',
  ];

  // Add production frontend URL from environment
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  return origins;
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, postman, etc.)
    if (!origin) return callback(null, true);

    // Check against static allowed origins
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check for dynamic WebContainer preview domains
    if (isWebContainerOrigin(origin)) {
      return callback(null, true);
    }

    // Check for Replit preview/dev domains
    if (isReplitOrigin(origin)) {
      return callback(null, true);
    }

    // Log rejected origins for debugging
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info', 'Apikey'],
};

app.use(cors(corsOptions));
app.use(express.json());

// ============================================================
// Helper Functions
// ============================================================

/**
 * Official WhatsApp Template Definitions for CyGnuS CRM Pro.
 *
 * Template Names (must match Meta Business Suite exactly):
 * - crm_received: New repair order received
 * - crm_ready_for_pickup: Repair completed, ready for pickup
 * - crm_cancelled: Repair order cancelled
 *
 * Parameter order is critical and must match the template body in Meta:
 * - crm_received: [name, brand, model, serial, repair_id, status]
 * - crm_ready_for_pickup: [name, brand, model, serial, repair_id, status, price_formatted]
 * - crm_cancelled: [name, repair_id]
 */
const WHATSAPP_TEMPLATES = {
  crm_received: {
    name: 'crm_received',
    paramCount: 6,
    description: 'New repair order received',
  },
  crm_ready_for_pickup: {
    name: 'crm_ready_for_pickup',
    paramCount: 7,
    description: 'Repair completed, ready for pickup',
  },
  crm_cancelled: {
    name: 'crm_cancelled',
    paramCount: 2,
    description: 'Repair order cancelled',
  },
  crm_restock_order: {
    name: 'crm_restock_order',
    paramCount: 4,
    description: 'Manual restock order to supplier',
  },
  crm_delivery_started: {
    name: 'crm_delivery_started',
    paramCount: 2,
    description: 'Delivery started — order on the way, with driver name',
  },
  crm_delivery_near: {
    name: 'crm_delivery_near',
    paramCount: 1,
    description: 'Driver is close to the destination',
  },
  crm_delivery_completed: {
    name: 'crm_delivery_completed',
    paramCount: 1,
    description: 'Delivery completed confirmation',
  },
  // Legacy templates (kept for backward compatibility)
  order_received: { name: 'crm_received', paramCount: 6, legacy: true },
  order_finished: { name: 'crm_ready_for_pickup', paramCount: 7, legacy: true },
  order_cancelled: { name: 'crm_cancelled', paramCount: 2, legacy: true },
};

/**
 * Resolve template name to official Meta template name.
 * Handles legacy template names by mapping to current names.
 */
function resolveTemplateName(template) {
  const mapping = {
    order_received: 'crm_received',
    order_finished: 'crm_ready_for_pickup',
    order_cancelled: 'crm_cancelled',
  };
  return mapping[template] || template;
}

/**
 * Build template parameters in the correct order for each template type.
 */
function buildTemplateParams(template, data) {
  const resolvedTemplate = resolveTemplateName(template);

  switch (resolvedTemplate) {
    case 'crm_received':
      // 6 params: [customer_name, brand, model, serial, repair_id, status]
      return [
        data.name || data.customer_name || '',
        data.brand || '',
        data.model || '',
        data.serial || '',
        data.repair_id || '',
        data.status || 'Received',
      ];

    case 'crm_ready_for_pickup': {
      // 7 params: [customer_name, brand, model, serial, repair_id, status, price]
      const price = data.price || 0;
      const priceFormatted = `${typeof price === 'number' ? price : parseFloat(price) || 0} USD`;
      return [
        data.name || data.customer_name || '',
        data.brand || '',
        data.model || '',
        data.serial || '',
        data.repair_id || '',
        data.status || 'Ready For Pickup',
        priceFormatted,
      ];
    }

    case 'crm_cancelled':
      // 2 params: [customer_name, repair_id]
      return [
        data.name || data.customer_name || 'N/A',
        data.repair_id || 'N/A',
      ];

    case 'crm_restock_order':
      // 4 params: [supplier_name, quantity, item_name, sku]
      return data.variables || [];

    case 'crm_delivery_started':
      // 2 params: [customer_name, driver_name]
      // Template: "Hi {{1}}, ... assigned to driver {{2}}, who is currently en route..."
      return [
        data.customer_name || 'N/A',
        data.driver_name || 'our driver',
      ];

    case 'crm_delivery_near':
      // 1 param: [customer_name]
      // Template: "Hi {{1}}, the driver is almost there (about 2 minutes away)..."
      return [
        data.customer_name || 'N/A',
      ];

    case 'crm_delivery_completed':
      // 1 param: [customer_name]
      // Template: "Hi {{1}}, we are pleased to confirm that your order has been delivered..."
      return [
        data.customer_name || 'N/A',
      ];

    default:
      return data.variables || [];
  }
}

function getWhatsAppConfig(providedConfig = {}) {
  return {
    phone_number_id: providedConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID || '',
    access_token: providedConfig.access_token || process.env.META_ACCESS_TOKEN || '',
    api_version: providedConfig.api_version || process.env.META_API_VERSION || 'v22.0',
  };
}

/**
 * Normalize phone number for WhatsApp/Meta API:
 * - Strips all spaces, dashes, parentheses, and special characters
 * - For Lebanon local 8-digit numbers: prepend '961' country code,
 *   stripping the trunk zero if the local number starts with one
 * - For international numbers: preserve full format
 *
 * Examples:
 * - '76809939'        → '96176809939'  (Lebanon local, no trunk zero)
 * - '03137869'        → '9613137869'   (Lebanon local, trunk zero stripped)
 * - '+961 03 137 869' → '9613137869'   (country code + trunk zero)
 * - '96103137869'     → '9613137869'   (safety net: 9610 → 961)
 * - '+44 7735 181560' → '447735181560' (international)
 */
function normalizePhoneForWhatsApp(phone) {
  if (!phone) return '';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If empty after cleaning, return empty
  if (!digits) return '';

  // Lebanon local 8-digit number: strip trunk zero then prepend 961
  // e.g. '03137869' → '3137869' → '9613137869'
  // e.g. '76809939' → '76809939' → '96176809939'
  if (digits.length === 8) {
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    return '961' + local;
  }

  // Safety net: country code was prepended but trunk zero was kept
  // e.g. '96103137869' → '9613137869'
  if (digits.startsWith('9610')) {
    return '961' + digits.slice(4);
  }

  // Already has country code or is international - return as-is
  return digits;
}

async function sendWhatsAppTemplate(config, phone, templateName, language, variables) {
  const { phone_number_id, access_token, api_version } = config;
  const url = `https://graph.facebook.com/${api_version}/${phone_number_id}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: variables.map((v) => ({ type: 'text', text: v })),
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    // Log the full Meta response so the exact rejection reason is visible in terminal
    console.error('[Meta API] Full error response:', JSON.stringify(data, null, 2));
    const metaError = new Error(data.error?.message || `Meta API error: ${response.status}`);
    metaError.metaResponse = data;
    throw metaError;
  }

  return data;
}

// ============================================================
// Health Check
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// WhatsApp API Routes
// ============================================================

app.post('/api/whatsapp/test', async (req, res) => {
  try {
    const config = getWhatsAppConfig(req.body);

    if (!config.phone_number_id || !config.access_token) {
      return res.status(400).json({
        success: false,
        error: 'Phone Number ID and Access Token are required',
      });
    }

    const url = `https://graph.facebook.com/${config.api_version}/${config.phone_number_id}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: data.error?.message || `Connection failed: ${response.status}`,
      });
    }

    res.json({
      success: true,
      message: 'Connection successful',
      phone_number: data.display_phone_number || data.verified_name || 'Connected',
    });
  } catch (err) {
    console.error('[WhatsApp Test] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { logId, phone, template, language, variables, repairData, config: providedConfig } = req.body;

    if (!phone || !template) {
      return res.status(400).json({
        success: false,
        error: 'Phone and template are required',
      });
    }

    const config = getWhatsAppConfig(providedConfig);

    if (!config.phone_number_id || !config.access_token) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp API not configured. Check server environment variables or provide config.',
      });
    }

    // Normalize phone number with intelligent Lebanon handling
    const normalizedPhone = normalizePhoneForWhatsApp(phone);

    // Resolve template name and build parameters in correct order
    const resolvedTemplate = resolveTemplateName(template);
    const templateParams = repairData
      ? buildTemplateParams(template, repairData)
      : variables || [];

    console.log(`[WhatsApp Send] Template: ${template} -> ${resolvedTemplate}, Params: ${templateParams.length}`);
    console.log('[WhatsApp Send] Pre-flight payload to Meta:', JSON.stringify({
      template_name: resolvedTemplate,
      language_code: 'en', // hardcoded — DB template_language ignored
      parameters: templateParams,
      to: normalizedPhone,
    }, null, 2));

    const result = await sendWhatsAppTemplate(
      config,
      normalizedPhone,
      resolvedTemplate,
      'en',
      templateParams
    );

    console.log(`[WhatsApp Send] Message sent: ${logId} -> ${normalizedPhone} (${resolvedTemplate})`);

    res.json({
      success: true,
      message_id: result.messages?.[0]?.id || 'unknown',
      log_id: logId,
      template_used: resolvedTemplate,
    });
  } catch (err) {
    console.error('[WhatsApp Send] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send message',
    });
  }
});

app.post('/api/whatsapp/resend', async (req, res) => {
  try {
    const { logId } = req.body;

    if (!logId) {
      return res.status(400).json({
        success: false,
        error: 'logId is required',
      });
    }

    res.json({
      success: true,
      message: `Resend triggered for log: ${logId}`,
      log_id: logId,
    });
  } catch (err) {
    console.error('[WhatsApp Resend] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to resend message',
    });
  }
});

// ============================================================
// Password Reset Routes (service-role — bypasses RLS)
// ============================================================

/**
 * POST /api/password-reset/request
 * Body: { username: string }
 * Creates a pending reset request + system notification.
 * Returns: { requestId: string }
 */
app.post('/api/password-reset/request', async (req, res) => {
  if (!pool) {
    console.error('[PasswordReset] DB pool not configured.');
    return res.status(503).json({ success: false, error: 'Database not configured.' });
  }

  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ success: false, error: 'username is required.' });
  }

  const name = username.trim();

  try {
    // 1. Insert the reset request — return the generated UUID
    const reqRows = await dbQuery(
      `INSERT INTO password_reset_requests (username, status)
       VALUES ($1, 'pending')
       RETURNING id`,
      [name]
    );
    const requestId = reqRows[0].id;
    console.log(`[PasswordReset] Created request ${requestId} for user "${name}"`);

    // 2. Insert matching system notification so admin bell lights up (non-fatal)
    try {
      await dbQuery(
        `INSERT INTO system_notifications (type, title, body, status, related_id, created_by)
         VALUES ('password_reset', 'Password Reset Request', $1, 'unread', $2, $3)`,
        [`${name} has requested a password reset.`, requestId, name]
      );
    } catch (notifErr) {
      console.error('[PasswordReset] Insert system_notifications failed (non-fatal):', notifErr.message);
    }

    return res.json({ success: true, requestId });
  } catch (err) {
    console.error('[PasswordReset] Insert failed:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Unexpected error.' });
  }
});

/**
 * GET /api/password-reset/:id
 * Returns the current status (and temp_password if approved) for a request.
 */
app.get('/api/password-reset/:id', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not configured.' });
  }

  const { id } = req.params;

  try {
    const rows = await dbQuery(
      `SELECT id, status, temp_password, resolved_at
       FROM password_reset_requests
       WHERE id = $1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }
    const row = rows[0];
    return res.json({
      success: true,
      status: row.status,
      tempPassword: row.status === 'approved' ? row.temp_password : null,
      resolvedAt: row.resolved_at,
    });
  } catch (err) {
    console.error('[PasswordReset] Fetch status failed:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Unexpected error.' });
  }
});

// ============================================================
// Error Handling
// ============================================================

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[CRM Pro Backend] Server running on port ${PORT}`);
  console.log(`[CORS] Static origins: ${getAllowedOrigins().join(', ')}`);
  console.log(`[CORS] Dynamic origins: *.webcontainer-api.io (WebContainer previews)`);
});

export default app;