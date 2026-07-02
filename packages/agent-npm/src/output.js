"use strict";

const isTTY = process.stdout.isTTY;

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function c(code, text) {
  if (!isTTY) return text;
  return `${code}${text}${colors.reset}`;
}

function green(text)   { return c(colors.green, text); }
function yellow(text)  { return c(colors.yellow, text); }
function cyan(text)    { return c(colors.cyan, text); }
function red(text)     { return c(colors.red, text); }
function bold(text)    { return c(colors.bold, text); }
function dim(text)     { return c(colors.dim, text); }

function check(text)   { return green(`✓ ${text}`); }
function arrow(text)   { return yellow(`↓ ${text}`); }
function bullet(text)  { return dim(`  ${text}`); }
function error(text)   { return red(`✗ ${text}`); }

function table(rows, spacing) {
  if (!spacing) {
    const lens = rows.map((r) => r.reduce((acc, c) => { acc.push(c.length); return acc; }, []));
    spacing = rows[0].map((_, i) => Math.max(...lens.map((r) => r[i])) + 2);
  }
  return rows.map((row) =>
    row.map((cell, i) => cell.padEnd(spacing[i])).join("")
  ).join("\n");
}

module.exports = { green, yellow, cyan, red, bold, dim, check, arrow, bullet, error, table };
