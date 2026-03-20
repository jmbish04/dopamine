import type { HealthPayload } from "@/api/health";

export const renderHealthDashboard = (payload: HealthPayload) => {
  const checkCards = payload.checks
    .map(
      (check) => `
        <article class="card">
          <div class="row">
            <strong>${check.module}</strong>
            <span class="${check.ok ? "ok" : "fail"}">${check.ok ? "OK" : "Issue"}</span>
          </div>
          <p>${check.dependency}</p>
          <small>${check.message}</small>
        </article>
      `,
    )
    .join("");

  const advice = payload.remediation.length
    ? `<section><h2>Suggested fixes</h2>${payload.remediation
        .map((item) => `<p><strong>${item.dependency}</strong>: ${item.suggestion}</p>`)
        .join("")}</section>`
    : "<section><h2>Suggested fixes</h2><p>Everything looks healthy.</p></section>";

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dopamine Health</title>
        <style>
          body { font-family: system-ui, sans-serif; background:#09090b; color:#fafafa; margin:0; padding:32px; }
          h1,h2,p { margin:0; }
          main { max-width: 920px; margin: 0 auto; display:grid; gap: 24px; }
          .grid { display:grid; gap: 16px; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); }
          .card, section { border:1px solid #27272a; border-radius: 16px; background:#111114; padding:16px; }
          .row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
          .ok, .fail { padding:4px 10px; border-radius:999px; font-size:12px; }
          .ok { background:#052e16; color:#86efac; }
          .fail { background:#450a0a; color:#fca5a5; }
          small { color:#a1a1aa; display:block; margin-top:8px; }
          a { color:#60a5fa; }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>Dopamine Health</h1>
            <p>Generated at ${payload.generatedAt}</p>
          </header>
          <div class="grid">${checkCards}</div>
          ${advice}
        </main>
      </body>
    </html>`;
};
