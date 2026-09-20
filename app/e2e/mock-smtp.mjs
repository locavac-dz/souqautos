// Lot 133 — FAUX serveur SMTP pour les tests de bout en bout : il reçoit les courriels que le site envoie (vraie
// bibliothèque nodemailer, vrai protocole SMTP) et les met à disposition des tests par HTTP. Aucun message ne part sur
// Internet, et les tests n'ont plus besoin du compte de test Ethereal (qui exige un accès réseau).
//
// Démarré par Playwright (playwright.config.ts) : SMTP sur le port 5188, consultation sur le port 5189.
//   GET  /__mails?to=adresse   courriels reçus pour cette adresse : [{ to, subject, html, links }]
//   POST /__reset              vide la boîte
//   GET  /__health

import net from "node:net";
import http from "node:http";

const SMTP_PORT = 5188;
const HTTP_PORT = 5189;
const mails = [];

// --- Décodage minimal (quoted-printable, base64, mots encodés RFC 2047) -------------------------------------------
function decodeQuotedPrintable(input) {
  const text = input.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(text[i], "latin1"));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

// Un objet long est coupé en plusieurs « mots encodés » séparés par une espace, qui ne fait PAS partie du texte
// (RFC 2047) : on la retire avant de décoder, sinon elle réapparaît au milieu des mots.
function decodeWords(value) {
  return value
    .replace(/(\?=)\s+(=\?)/g, "$1$2")
    .replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=/gi, (_, kind, data) =>
      kind.toUpperCase() === "B" ? Buffer.from(data, "base64").toString("utf8") : decodeQuotedPrintable(data.replace(/_/g, " "))
    );
}

function splitMessage(raw) {
  const cut = raw.indexOf("\r\n\r\n");
  const head = cut === -1 ? raw : raw.slice(0, cut);
  const body = cut === -1 ? "" : raw.slice(cut + 4);
  const headers = {};
  for (const line of head.replace(/\r\n[ \t]+/g, " ").split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
  }
  return { headers, body };
}

function decodeBody(headers, body) {
  const encoding = (headers["content-transfer-encoding"] ?? "7bit").toLowerCase();
  if (encoding === "base64") return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  if (encoding === "quoted-printable") return decodeQuotedPrintable(body);
  return body;
}

function htmlOf(headers, body) {
  const type = headers["content-type"] ?? "";
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
  if (!boundary) return decodeBody(headers, body);
  for (const part of body.split(`--${boundary}`)) {
    const inner = splitMessage(part.replace(/^\r\n/, ""));
    if ((inner.headers["content-type"] ?? "").toLowerCase().startsWith("text/html")) return decodeBody(inner.headers, inner.body);
  }
  return "";
}

function parseMail(rcpt, raw) {
  const unstuffed = raw.replace(/\r\n\.\./g, "\r\n.");
  const { headers, body } = splitMessage(unstuffed);
  const html = htmlOf(headers, body);
  return {
    to: rcpt,
    subject: decodeWords(headers.subject ?? ""),
    html,
    links: [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    receivedAt: Date.now(),
  };
}

// --- Protocole SMTP ------------------------------------------------------------------------------------------------
net
  .createServer((socket) => {
    socket.setEncoding("utf8");
    socket.on("error", () => undefined);
    let buffer = "";
    let inData = false;
    let rcpt = [];
    const reply = (text) => socket.write(`${text}\r\n`);
    reply("220 mock-smtp prêt");

    socket.on("data", (chunk) => {
      buffer += chunk;
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          const raw = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          for (const to of rcpt) mails.push(parseMail(to, raw));
          rcpt = [];
          inData = false;
          reply("250 OK message reçu");
          continue;
        }
        const newline = buffer.indexOf("\r\n");
        if (newline === -1) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) socket.write("250-mock-smtp\r\n250 OK\r\n");
        else if (upper.startsWith("MAIL FROM")) reply("250 OK");
        else if (upper.startsWith("RCPT TO")) {
          rcpt.push(/<([^>]*)>/.exec(line)?.[1] ?? "");
          reply("250 OK");
        } else if (upper === "DATA") {
          inData = true;
          reply("354 envoyez le message");
        } else if (upper === "QUIT") {
          reply("221 au revoir");
          socket.end();
          return;
        } else if (upper === "RSET" || upper === "NOOP") reply("250 OK");
        else reply("502 commande non gérée");
      }
    });
  })
  .listen(SMTP_PORT, () => console.log(`[faux SMTP] SMTP ${SMTP_PORT}, consultation http://localhost:${HTTP_PORT}`));

// --- Consultation par les tests ------------------------------------------------------------------------------------
http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${HTTP_PORT}`);
    const json = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (url.pathname === "/__health") return json(200, { ok: true });
    if (req.method === "POST" && url.pathname === "/__reset") {
      mails.length = 0;
      return json(204);
    }
    if (req.method === "GET" && url.pathname === "/__mails") {
      const to = url.searchParams.get("to")?.toLowerCase();
      return json(200, mails.filter((mail) => !to || mail.to.toLowerCase() === to));
    }
    json(404, { error: "not_found" });
  })
  .listen(HTTP_PORT);
