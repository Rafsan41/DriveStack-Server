/**
 * Server-rendered HTML for GET /health when a browser asks for it.
 *
 * The route stays content-negotiated: machines (fetch/curl/monitoring) still get
 * JSON, so this is purely the human-facing view. Values are server-controlled,
 * but they are HTML-escaped anyway as a matter of hygiene.
 */

export interface HealthPageData {
  status: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  node: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Turns a duration in seconds into a compact "1h 04m 09s" string. */
function formatUptime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export function renderHealthPage(data: HealthPageData): string {
  const env = esc(data.environment);
  const timestamp = esc(data.timestamp);
  const node = esc(data.node);
  const uptime = esc(formatUptime(data.uptimeSeconds));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Health · DriveStack</title>
    <meta name="robots" content="noindex" />
    <link rel="stylesheet" href="/styles.css" />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%9A%A6%3C/text%3E%3C/svg%3E"
    />
  </head>
  <body class="health-body">
    <main class="health">
      <a class="health-back" href="/">← Back to console</a>

      <section class="health-panel">
        <div class="health-beacon" aria-hidden="true">
          <span class="health-beacon-core"></span>
        </div>
        <p class="health-eyebrow">System status</p>
        <h1 class="health-title">All systems go</h1>
        <p class="health-sub">DriveStack is up and serving requests.</p>

        <!-- a little car doing a victory lap -->
        <div class="health-track" aria-hidden="true">
          <div class="health-car">
            <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
              <path
                class="car-body"
                d="M4 40 Q6 28 18 26 L34 26 Q42 14 60 14 L82 14 Q98 14 106 28 L114 32 Q118 33 118 39 L118 44 Q118 47 113 47 L8 47 Q4 47 4 43 Z"
              />
              <path class="car-glass" d="M40 26 Q47 18 60 18 L72 18 L75 26 Z" />
              <circle class="car-head" cx="115" cy="36" r="2.5" />
              <g class="wheel">
                <circle class="tire" cx="36" cy="47" r="10" />
                <circle class="hub" cx="36" cy="47" r="4" />
              </g>
              <g class="wheel">
                <circle class="tire" cx="92" cy="47" r="10" />
                <circle class="hub" cx="92" cy="47" r="4" />
              </g>
            </svg>
          </div>
        </div>

        <dl class="health-metrics">
          <div class="health-metric">
            <dt>Status</dt>
            <dd><span class="health-ok-dot"></span>${esc(data.status)}</dd>
          </div>
          <div class="health-metric">
            <dt>Environment</dt>
            <dd>${env}</dd>
          </div>
          <div class="health-metric">
            <dt>Uptime</dt>
            <dd>${uptime}</dd>
          </div>
          <div class="health-metric">
            <dt>Node</dt>
            <dd>${node}</dd>
          </div>
          <div class="health-metric health-metric--wide">
            <dt>Checked at</dt>
            <dd>${timestamp}</dd>
          </div>
        </dl>

        <div class="health-actions">
          <a class="cta" href="/health">↻ Refresh</a>
          <a class="ghost-btn health-json" href="/health?format=json">View raw JSON</a>
        </div>
      </section>
    </main>
  </body>
</html>
`;
}
