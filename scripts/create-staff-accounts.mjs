#!/usr/bin/env node
/**
 * Bulk-create Supabase Auth users + public.user_roles for school staff
 * so emails are reserved before self-signup.
 *
 * Prerequisites:
 *   - SUPABASE_URL (e.g. https://xxxxx.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API → service_role)
 *
 * Input: JSON Lines (.jsonl). One JSON object per line:
 *   { "email", "password", "role", "display_name", "subject?" }
 *   role must be one of: teacher | counselor | staff | admin
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-staff-accounts.mjs ./my-staff.jsonl
 *
 * If the email already exists, the script looks up the user id (paginated
 * admin list), updates the password, and upserts user_roles so you can
 * re-run safely after fixing a row.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLES = new Set(["teacher", "counselor", "staff", "admin"]);

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      rows.push(JSON.parse(lines[i]));
    } catch (e) {
      throw new Error(`Line ${i + 1}: invalid JSON — ${e.message}`);
    }
  }
  return rows;
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

async function findUserIdByEmail(base, serviceKey, email) {
  const want = String(email).trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { res, json } = await adminFetch(
      base,
      serviceKey,
      `/auth/v1/admin/users?page=${page}&per_page=200`,
      { method: "GET" },
    );
    if (!res.ok) {
      throw new Error(`admin list users failed: ${res.status} ${JSON.stringify(json)}`);
    }
    const users = json.users || [];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === want);
    if (hit?.id) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

async function createOrUpdateUser(base, serviceKey, row) {
  const email = String(row.email || "").trim().toLowerCase();
  const password = String(row.password || "");
  const role = String(row.role || "").trim().toLowerCase();
  const display_name = String(row.display_name || "").trim();
  const subject = row.subject != null ? String(row.subject).trim() : "";

  if (!email || !email.includes("@")) throw new Error("invalid email");
  if (password.length < 8) throw new Error("password must be at least 8 characters");
  if (!ROLES.has(role)) throw new Error(`role must be one of: ${[...ROLES].join(", ")}`);
  if (!display_name) throw new Error("display_name required");

  const body = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: display_name,
      role,
    },
  };

  let { res, json } = await adminFetch(base, serviceKey, `/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  let userId = json?.user?.id || json?.id;

  if (res.status === 422 || json?.error_code === "email_exists") {
    userId = await findUserIdByEmail(base, serviceKey, email);
    if (!userId) throw new Error("email exists but could not resolve user id (list users)");
    const patchRes = await adminFetch(base, serviceKey, `/auth/v1/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: {
          full_name: display_name,
          role,
        },
      }),
    });
    if (!patchRes.res.ok) {
      throw new Error(`update user failed: ${patchRes.res.status} ${JSON.stringify(patchRes.json)}`);
    }
    return { userId, existed: true };
  }

  if (!res.ok) {
    throw new Error(`create user failed: ${res.status} ${JSON.stringify(json)}`);
  }
  if (!userId) throw new Error("create user: missing id in response");
  return { userId, existed: false };
}

async function upsertUserRole(base, serviceKey, userId, role, display_name, subject) {
  const row = {
    user_id: userId,
    role,
    display_name,
    subject: subject || null,
    updated_at: new Date().toISOString(),
  };
  const { res, json } = await adminFetch(base, serviceKey, "/rest/v1/user_roles", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`user_roles upsert failed: ${res.status} ${JSON.stringify(json)}`);
  }
}

async function main() {
  const base = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const fileArg = process.argv[2] || path.join(__dirname, "staff-import.example.jsonl");

  if (!base || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }

  const rows = readJsonl(abs);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = row.email || `line ${i + 1}`;
    try {
      const { userId, existed } = await createOrUpdateUser(base, serviceKey, row);
      await upsertUserRole(
        base,
        serviceKey,
        userId,
        String(row.role).trim().toLowerCase(),
        String(row.display_name).trim(),
        row.subject != null ? String(row.subject).trim() : "",
      );
      console.log(`${existed ? "↻" : "✓"} ${label} → ${userId}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${label}: ${e.message || e}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
