// The preset styles. A style is drawn from these numbers, so it fits a photo of any size and shape.

// The faces of the text. The files are in /fonts/, and a style loads the ones of its lines.
// Each face has a family of its own. See frame.js for the reason.
export const FACES = {
  sans: { family: 'Frame Sans', weight: 400, file: 'inter-400.woff2', fallback: 'system-ui, sans-serif' },
  strong: { family: 'Frame Strong', weight: 600, file: 'inter-600.woff2', fallback: 'system-ui, sans-serif' },
  mono: { family: 'Frame Mono', weight: 500, file: 'ibm-plex-mono-500.woff2', fallback: 'ui-monospace, monospace' },
  edge: { family: 'Frame Edge', weight: 600, file: 'barlow-condensed-600.woff2', fallback: '"Arial Narrow", sans-serif' },
  hand: { family: 'Frame Hand', weight: 500, file: 'caveat-500.woff2', fallback: '"Segoe Print", "Bradley Hand", cursive' },
};

const CAMERA = '{camera}';
const EXPOSURE = '{focal}  {aperture}  {shutter}  {iso}';

// A style is { pad, paper, ink, rule, round, shade, lines }. All of its sizes are in hundredths
// of the shorter side of the photo.
//   pad    The margins around the photo: top, right, bottom, left.
//   paper  The color of the margins. A style without margins has none.
//   ink    The color of the text.
//   rule   The color of a fine line on the edge of the photo. It keeps a pale photo apart
//          from pale paper, and a dark one from dark paper.
//   round  The radius of the corners of the photo.
//   shade  The color of a soft shade behind the text, for text over the photo.
// A line of text is { text, zone, at, align, dy, size, face, track, upper, alpha, max, lead, edit }.
//   text   The text, with tokens such as {camera}. See exif.js for the tokens.
//   zone   Where the line is: in the 'top' margin, in the 'bottom' margin, or 'over' the photo,
//          at its lower edge. In a margin, the line is at its middle, moved down by dy.
//   at     The place across the photo, from 0 at its left edge to 1 at its right edge.
//   align  The side of the text that is at that place. Without it, 0 is the left side,
//          0.5 the center, and 1 the right side.
//   track  More space between the letters, as a part of the size.
//   max    The most of the width of the photo that the line may take. A longer one gets smaller.
//   lead   'play' draws the arrow of a film strip before the text.
//   edit   The line that the caption of the user replaces.
const below = [
  { text: CAMERA, zone: 'bottom', at: 0, dy: -1.9, size: 2.7, face: 'strong', max: 0.48 },
  { text: '{lens}', zone: 'bottom', at: 0, dy: 1.9, size: 2, face: 'sans', alpha: 0.55, max: 0.48 },
  { text: EXPOSURE, zone: 'bottom', at: 1, dy: -1.9, size: 2.3, face: 'mono', max: 0.48, edit: true },
  { text: '{date}', zone: 'bottom', at: 1, dy: 1.9, size: 2, face: 'mono', alpha: 0.55, max: 0.48 },
];
const over = [
  { text: CAMERA, zone: 'over', at: 0, size: 2.4, face: 'strong', max: 0.46 },
  { text: EXPOSURE, zone: 'over', at: 1, size: 2.1, face: 'mono', max: 0.5, edit: true },
];
const DARK_RULE = 'rgba(0, 0, 0, 0.12)';
const LIGHT_RULE = 'rgba(255, 255, 255, 0.1)';

// The names are the values of the style field on the page.
export const STYLES = {
  'none': { pad: [0, 0, 0, 0], lines: [] },
  'border-white': { pad: [4, 4, 4, 4], paper: '#ffffff', rule: DARK_RULE, lines: [] },
  'border-black': { pad: [4, 4, 4, 4], paper: '#0c0c0c', rule: LIGHT_RULE, lines: [] },
  'caption-white': { pad: [4, 4, 13.5, 4], paper: '#ffffff', ink: '#17191a', rule: DARK_RULE, lines: below },
  'caption-black': { pad: [4, 4, 13.5, 4], paper: '#0c0c0c', ink: '#f2f2ee', rule: LIGHT_RULE, lines: below },
  'caption-centered': {
    pad: [5, 5, 15.5, 5],
    paper: '#ffffff',
    ink: '#17191a',
    rule: DARK_RULE,
    lines: [
      { text: CAMERA, zone: 'bottom', at: 0.5, dy: -2, size: 2.5, face: 'strong', track: 0.16, upper: true, max: 0.9 },
      { text: EXPOSURE, zone: 'bottom', at: 0.5, dy: 2.1, size: 2.1, face: 'mono', alpha: 0.6, max: 0.9, edit: true },
    ],
  },
  'overlay-white': { pad: [0, 0, 0, 0], ink: '#ffffff', shade: 'rgba(0, 0, 0, 0.35)', lines: over },
  'overlay-black': { pad: [0, 0, 0, 0], ink: '#0c0c0c', shade: 'rgba(255, 255, 255, 0.35)', lines: over },
  'film-edge': {
    pad: [7.5, 3.5, 7.5, 3.5],
    paper: '#0a0a0a',
    ink: '#f0a236',
    round: 0.7,
    lines: [
      { text: '{lens}', zone: 'top', at: 0.03, size: 2.7, face: 'edge', track: 0.1, upper: true, max: 0.5, edit: true },
      { text: CAMERA, zone: 'top', at: 0.97, align: 'right', size: 2.7, face: 'edge', track: 0.1, upper: true, max: 0.4 },
      { text: '{frame}', zone: 'bottom', at: 0.12, size: 2.7, face: 'edge', track: 0.1, lead: 'play' },
      { text: '{frame}A', zone: 'bottom', at: 0.62, size: 2.7, face: 'edge', track: 0.1, lead: 'play' },
    ],
  },
  'instant': {
    pad: [5.5, 5.5, 21, 5.5],
    paper: '#f7f5ef',
    ink: '#33312e',
    rule: DARK_RULE,
    lines: [
      { text: '{date}', zone: 'bottom', at: 0.5, dy: -0.4, size: 6.4, face: 'hand', max: 0.9, edit: true },
    ],
  },
};
