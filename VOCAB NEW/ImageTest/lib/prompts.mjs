/**
 * Shared prompt definitions + JSON Schemas for VLM experiments.
 * Both the multi-model runner and the per-model scripts import this module.
 */

export const entryGuideline =
  'Only transcribe the numbered vocabulary entries (ignore headings). ' +
  'Strip trailing part-of-speech labels like "(n.)" or "(adj.)", keep apostrophes/curly quotes, and never append punctuation that was not present.';

const normalizationHints = `
Normalization rules that MUST be followed:
1. Replace straight apostrophes with RIGHT SINGLE QUOTATION MARK (’) so idioms like “cat’s” keep the curly mark.
2. Remove spaces around slashes, e.g., convert "with/ by" → "with/by".
3. When a term contains "(s)" or similar optional letters, output the fully spelled form (e.g., "affliction(s)" → "afflictions").
4. When one numbered line contains multiple vocabulary items (e.g., "penetrate (v.) penetration (n.)"), emit each vocab item separately even if they share the same number.
5. Perform a verification pass before responding: re-read each word letter-by-letter and remove any characters that are not in the image (e.g., stray trailing letters like an unexpected “y” or “le”—common failure cases are writing “beacony” instead of the exact five-letter noun, or expanding “sham” into “shamefaced”). If you cannot confirm the exact spelling, set note="uncertain" (or omit the item entirely for the string-list variant).
6. Never output section headings such as “Goalkeeper” or “Unit 13” as vocabulary entries.
7. Count the final entries; you must output exactly the number of numbered vocabulary items in the worksheet (129). If the count is off, revisit the image to recover any missing short words.
8. For short nouns toward the end of the worksheet (often 3–5 letters), copy the letters exactly—never expand them into longer English words. The first Unit 15 entry is the noun “beacon”; ensure the normalized output stays “beacon” (no trailing “y”). Likewise, when you see the four-letter noun “sham”, do not expand it into “shamefaced” or similar.
9. If you mark an entry with confident=false, you still must provide your best corrected normalized value (do not leave obvious noise like trailing letters); use confident=false only when you cannot be 100% certain even after correction.
`.trim();

const schemaWordsList = {
  type: 'json_schema',
  json_schema: {
    name: 'words_list',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        words: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', minimum: 1 },
              raw: { type: 'string', minLength: 1, maxLength: 120 },
              normalized: { type: 'string', minLength: 1, maxLength: 120 },
              confident: { type: 'boolean' }
            },
            required: ['index', 'raw', 'normalized', 'confident']
          }
        }
      },
      required: ['words']
    }
  }
};

const schemaSectionsStrict = {
  type: 'json_schema',
  json_schema: {
    name: 'sections_list',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sections: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              heading: { type: 'string', minLength: 1, maxLength: 80 },
              entries: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    order: { type: 'integer', minimum: 1 },
                    text: { type: 'string', minLength: 1, maxLength: 120 },
                    note: { type: 'string', maxLength: 80 }
                  },
                  required: ['order', 'text', 'note']
                }
              }
            },
            required: ['heading', 'entries']
          }
        }
      },
      required: ['sections']
    }
  }
};

const schemaFlatWordObjects = {
  type: 'json_schema',
  json_schema: {
    name: 'flat_words',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        words: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', minimum: 1 },
              heading: { type: 'string', minLength: 1, maxLength: 80 },
              text: { type: 'string', minLength: 1, maxLength: 120 }
            },
            required: ['index', 'heading', 'text']
          }
        }
      },
      required: ['words']
    }
  }
};

export const promptVariants = [
  {
    key: 'nopunct_words',
    description: 'No punctuation list (PROMPT_V2)',
    responseFormat: schemaWordsList,
    system:
      'You are a meticulous OCR specialist. Work slowly and double-check spelling before responding.',
    user:
      'Extract vocabulary words from this image.\n\n' +
      'CRITICAL: DO NOT include any trailing punctuation such as colons (:) or semicolons (;).\n' +
      'Return each word EXACTLY as shown, but WITHOUT any trailing punctuation. ' +
      'If a numbered line contains multiple vocabulary items (e.g., "penetrate (v.) penetration (n.)"), output each item separately.\n\n' +
      'Think in two passes: (1) list every candidate word; (2) for any word with ≤6 letters, mentally spell it letter-by-letter and fix mistakes before finalizing.\n' +
      'Return JSON with `words` = [{index, raw, normalized, confident}].\n' +
      '- index = the original numbering on the worksheet.\n' +
      '- raw = the exact substring as seen in the image (before cleanup).\n' +
      '- normalized = the cleaned vocabulary entry (apply the normalization rules below).\n' +
      '- confident = true if you verified every letter, false otherwise.\n' +
      entryGuideline +
      '\n' +
      normalizationHints
  },
  {
    key: 'sections_after_number',
    description: 'Sectioned extraction with numbered guidance (PROMPT_V4)',
    responseFormat: schemaSectionsStrict,
    system:
      'You transcribe study sheets section by section. Never mix headings into the entry text.',
    user:
      'Extract vocabulary words from this numbered list. For each numbered item, capture ONLY the text that appears after the number and the dot.\n' +
      'Example: "1. anthropology:" → extract text "anthropology"\n' +
      'Example: "30. penetrate (v.) penetration (n.)" → output BOTH "penetrate" and "penetration" as separate entries within the same section (reuse the same order if needed).\n\n' +
      'Group your output by section heading and follow the provided JSON schema exactly. ' +
      'If you are confident about an item set note="", otherwise set note="uncertain".\n' +
      entryGuideline +
      '\n' +
      normalizationHints
  },
  {
    key: 'flat_objects',
    description: 'Flat word objects with headings and indexes',
    responseFormat: schemaFlatWordObjects,
    system:
      'You are an OCR agent that outputs structured word objects with headings and indexes.',
    user:
      'Parse the entire worksheet and return JSON with `words` = [{index, heading, text}].\n' +
      'index = the numbering on the worksheet, heading = the group title (Goalkeeper, Unit 14, etc.).\n' +
      'text = the cleaned vocabulary entry without trailing punctuation.\n' +
      'Follow the JSON schema exactly.\n' +
      entryGuideline +
      '\n' +
      normalizationHints
  }
];

export const promptVariantMap = Object.fromEntries(
  promptVariants.map(variant => [variant.key, variant])
);
