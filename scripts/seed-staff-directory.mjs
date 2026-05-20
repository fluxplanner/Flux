#!/usr/bin/env node
/**
 * Upsert public.staff_directory from a JSONL roster (IAE / Bloomfield).
 * Does not create Auth users — use create-staff-accounts.mjs for that.
 *
 * Prerequisites:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Input (JSONL, one object per line):
 *   { "email", "role", "display_name", "subject?" }
 *   Legacy alias: "name" → display_name
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/seed-staff-directory.mjs scripts/staff-import-ia-east.jsonl
 *
 * Idempotent: matches rows by lower(trim(school_email)). Does not overwrite
 * claimed directory rows (is_claimed = true).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROLES = new Set(["teacher", "counselor", "staff", "admin"]);

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        throw new Error(`Line ${i + 1}: invalid JSON — ${e.message}`);
      }
    });
}

function splitDeptSubject(subject) {
  const s = String(subject || "").trim();
  if (!s) return { department: null, subject: null };
  const deptHints = [
    "Secretary",
    "Principal",
    "Assistant Principal",
    "Counseling",
    "Safe-Ed",
    "Technology",
    "Computer Techs",
  ];
  if (deptHints.some((h) => s === h || s.startsWith(h))) {
    return { department: s, subject: null };
  }
  return { department: null, subject: s };
}

async function adminFetch(base, serviceKey, pathname, opts = {}) {
  const url = `${base.replace(/\/+$/, "")}${pathname}`;
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
    ...opts.headers,
  };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function findBySchoolEmail(base, serviceKey, email) {
  const e = encodeURIComponent(email);
  const { res, json } = await adminFetch(
    base,
    serviceKey,
    `/rest/v1/staff_directory?school_email=eq.${e}&select=id,is_claimed,claimed_by&limit=1`,
    { method: "GET" },
  );
  if (!res.ok) {
    throw new Error(`staff_directory lookup failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return Array.isArray(json) && json[0] ? json[0] : null;
}

async function upsertDirectoryRow(base, serviceKey, row) {
  const school_email = String(row.email || row.school_email || "")
    .trim()
    .toLowerCase();
  const full_name = String(row.display_name || row.name || row.full_name || "").trim();
  const role = String(row.role || "").trim().toLowerCase();
  const { department, subject } = splitDeptSubject(row.subject);

  if (!school_email || !school_email.includes("@")) throw new Error("invalid email");
  if (!full_name) throw new Error("display_name required");
  if (!ROLES.has(role)) throw new Error(`invalid role: ${role}`);

  const payload = {
    full_name,
    role,
    department,
    subject,
    school_email,
    active: true,
  };

  const existing = await findBySchoolEmail(base, serviceKey, school_email);
  if (existing?.is_claimed) {
    return { action: "skip-claimed", id: existing.id, school_email };
  }

  if (existing?.id) {
    const { res, json } = await adminFetch(
      base,
      serviceKey,
      `/rest/v1/staff_directory?id=eq.${existing.id}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`PATCH failed: ${res.status} ${JSON.stringify(json)}`);
    }
    return { action: "updated", id: existing.id, school_email };
  }

  const { res, json } = await adminFetch(base, serviceKey, "/rest/v1/staff_directory", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, is_claimed: false }),
  });
  if (!res.ok) {
    throw new Error(`INSERT failed: ${res.status} ${JSON.stringify(json)}`);
  }
  const id = Array.isArray(json) && json[0]?.id ? json[0].id : json?.id;
  return { action: "inserted", id, school_email };
}

async function main() {
  const base = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const fileArg =
    process.argv[2] || path.join(__dirname, "staff-import-ia-east.jsonl");

  if (!base || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }

  const rows = readJsonl(abs);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i++) {
    const label = rows[i].email || `line ${i + 1}`;
    try {
      const r = await upsertDirectoryRow(base, serviceKey, rows[i]);
      if (r.action === "inserted") inserted++;
      else if (r.action === "updated") updated++;
      else skipped++;
      console.log(`${r.action === "skip-claimed" ? "⊘" : "✓"} ${label} (${r.action})`);
    } catch (e) {
      console.error(`✗ ${label}: ${e.message || e}`);
      fail++;
    }
  }

  console.log(
    `\nDone. inserted=${inserted} updated=${updated} skipped_claimed=${skipped} failed=${fail}`,
  );
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
