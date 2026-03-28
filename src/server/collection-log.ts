import fs from 'fs';
import path from 'path';

export const COLLECTION_PAGE_REMAP: Record<string, string> = {
  'The Grumbler': 'Phantom Muspah',
};

export const COLLECTION_ITEM_REMAP: Record<string, string> = {
  "Pharaoh's sceptre": "Pharaoh's sceptre (uncharged)",
};

export const COLLECTION_ITEM_ID_REMAP: Record<number, number> = {
  25627: 12019, // coal bag
  25628: 12020, // gem bag
  25629: 24882, // plank sack
  25617: 10859, // tea flask
  25618: 10877, // plain satchel
  25619: 10878, // green satchel
  25620: 10879, // red satchel
  25621: 10880, // black stachel
  25622: 10881, // gold satchel
  25623: 10882, // rune satchel
  25624: 13273, // unsired pet
  25630: 12854, // Flamtaer bag
  29992: 29990, // Alchemist's amulet
  30805: 30803, // Dossier
};

let COLLECTION_LOG_DATA: string;
try {
  COLLECTION_LOG_DATA = fs.readFileSync(
    path.join(__dirname, '..', '..', 'collection_log_info.json'),
    'utf8'
  );
} catch {
  COLLECTION_LOG_DATA = '{}';
}

export { COLLECTION_LOG_DATA };
