/**
 * Portraits added through the admin page.
 *
 * The roster ships with a struck plate for every character who has no freely
 * licensed photograph. This script looks for uploaded ones and swaps them in,
 * so adding a portrait never needs a redeploy.
 *
 * Images live in Firestore rather than Storage: one document per character,
 * holding a resized JPEG as a data URI. That keeps the whole feature inside a
 * service the project already uses, with no bucket to configure. Each document
 * stays well under Firestore's 1 MB ceiling — the admin page resizes before it
 * uploads.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getFirestore, collection, getDocs,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBmd-DdzYalWmQyRXFjiUZacUGZaG1iAvs',
  authDomain: 'techbyvansh-33439.firebaseapp.com',
  projectId: 'techbyvansh-33439',
  storageBucket: 'techbyvansh-33439.firebasestorage.app',
  messagingSenderId: '380086421878',
  appId: '1:380086421878:web:1c5971513ea66827',
};

export const COLLECTION = 'site_portraits';

export function db() {
  return getFirestore(initializeApp(FIREBASE_CONFIG));
}

/** Slug used as the document id — must match the admin page. */
export function slugFor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function applyPortraits() {
  const cards = document.querySelectorAll('.char');
  if (!cards.length) return;

  let snap;
  try {
    snap = await getDocs(collection(db(), COLLECTION));
  } catch {
    return;               // offline, or the collection does not exist yet
  }

  const byId = new Map();
  snap.forEach(d => {
    const data = d.data();
    if (data && data.image) byId.set(d.id, data.image);
  });
  if (!byId.size) return;

  cards.forEach(card => {
    const name = card.querySelector('.char__name')?.textContent?.trim();
    if (!name) return;
    const src = byId.get(slugFor(name));
    if (!src) return;

    const plate = card.querySelector('.plate');
    if (!plate || plate.querySelector('.portrait')) return;

    const img = new Image();
    img.className = 'portrait';
    img.alt = 'Portrait of ' + name;
    img.decoding = 'async';
    // Only reveal once decoded, so the plate never flashes half-drawn.
    img.onload = () => {
      plate.appendChild(img);
      card.classList.add('char--photo');
    };
    img.src = src;
  });
}

applyPortraits();
