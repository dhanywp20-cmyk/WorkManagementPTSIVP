---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

Sumber: vercel-labs/agent-skills (MIT) - skill `web-design-guidelines`. Aturannya disalin ke berkas lokal
`pedoman.md` (dari vercel-labs/web-interface-guidelines `command.md`, diambil 24 Okt 2026 & sudah dibaca)
alih-alih diunduh ulang dari GitHub setiap kali dipakai: isi skill tidak berubah diam-diam & tetap jalan
tanpa jaringan. Perbarui dengan mengunduh ulang `command.md`, membacanya, lalu mengganti `pedoman.md`.

## How It Works

1. Read the rules in `pedoman.md` (next to this file)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in `pedoman.md`
4. Output findings in the terse `file:line` format

## Usage

When a user provides a file or pattern argument:
1. Read `pedoman.md`
2. Read the specified files
3. Apply all rules from `pedoman.md`
4. Output findings using the format specified in `pedoman.md`

If no files specified, ask the user which files to review.

Proyek ini berbahasa Indonesia: laporkan temuan dalam bahasa Indonesia, kode & nama berkas apa adanya.
