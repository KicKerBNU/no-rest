#!/usr/bin/env node
/**
 * Fetches utility runes from NoRestForTheWicked.gg and writes data/utility-runes.json.
 * Run manually: node scripts/fetch-utility-runes.mjs
 * Also run monthly via GitHub Actions (see .github/workflows/update-utility-runes.yml).
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'utility-runes.json');
const SOURCE_URL = 'https://www.norestforthewicked.gg/db/runes?type=utility';
const BASE_URL = 'https://www.norestforthewicked.gg';

function inferCategory(name) {
  if (/resistance$/i.test(name)) return 'Resistance';
  if (/enchantment$/i.test(name)) return 'Enchantment';
  if (name === 'Blink') return 'Mobility';
  if (name === 'Channel' || name === 'Focus Halo') return 'Focus';
  if (name === 'Heal' || name === 'Heal Aura' || name === 'Pulse of Health') return 'Recovery';
  if (name === 'Damage Surge') return 'Offense';
  if (name === 'Poise Shield' || name === 'Thorns') return 'Defense';
  if (name === 'Return') return 'Traversal';
  if (name === 'Illuminate' || name === 'Repair') return 'Utility';
  if (name === 'Scream') return 'Crowd Control';
  if (name === 'Stamina Wellspring') return 'Stamina';
  return 'Utility';
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchUtilityRunes() {
  const { data: html } = await axios.get(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NoRestBot/1.0)',
      Accept: 'text/html',
    },
  });

  const runeLinkRe = /href="(\/db\/runes\/(\d+))"[^>]*class="[^"]*item-name[^"]*"[^>]*>\s*<!--\[-->\s*([^<]+)/g;
  const runes = [];
  let match;
  const links = [];
  while ((match = runeLinkRe.exec(html)) !== null) {
    links.push({ url: match[1], id: match[2], name: match[3].trim() });
  }

  for (let i = 0; i < links.length; i++) {
    const { url, id, name } = links[i];
    const nextStart = i + 1 < links.length
      ? html.indexOf(links[i + 1].url)
      : html.length;
    const blockStart = html.indexOf(url);
    const block = html.slice(blockStart, nextStart);

    const descMatch = block.match(/description-divider"><\/div>([^<]+)<\/div>/);
    const description = descMatch ? stripHtml(descMatch[1]).trim() : '';

    let cost = '';
    const chargingMatch = block.match(/Charging Cost\s*<\/div>[\s\S]*?<div[^>]*>(\d+)<\/div>/);
    if (chargingMatch) {
      cost = `Charging Cost: ${chargingMatch[1]} Focus`;
    } else {
      const costMatch = block.match(/Cost\s*<\/div>[\s\S]*?<div[^>]*>(\d+)<\/div>/);
      if (costMatch) {
        cost = `${costMatch[1]} Focus`;
      }
    }

    const effects = [];
    const effectDivRe = /special-effect[^>]*>([\s\S]*?)<\/div>\s*<!--\]-->/g;
    let effMatch;
    while ((effMatch = effectDivRe.exec(block)) !== null) {
      let text = stripHtml(effMatch[1]).trim();
      if (text.startsWith('Effects ')) text = text.slice(8);
      if (text && !text.startsWith('Applies To')) {
        effects.push(text);
      }
    }
    if (effects.length === 0 && description) {
      effects.push(description.slice(0, 200));
    }

    runes.push({
      name,
      category: inferCategory(name),
      cost: cost || 'See source',
      effects: effects.length ? effects : [description || 'See source'],
      description: description || `Utility rune: ${name}.`,
      sourceUrl: `${BASE_URL}${url}`,
    });
  }

  return runes;
}

async function main() {
  console.log('Fetching utility runes from', SOURCE_URL);
  const runes = await fetchUtilityRunes();
  console.log('Parsed', runes.length, 'utility runes');

  const outPath = path.dirname(DATA_FILE);
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(runes, null, 2) + '\n', 'utf8');
  console.log('Wrote', DATA_FILE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
