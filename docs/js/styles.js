// The preset styles. A style is drawn from these numbers, so it fits a photo of any size and shape.

// The faces of the text. The files are in /fonts/, and a style loads the ones of its lines.
// Each face has a family of its own. See frame.js for the reason.
export const FACES = {
  sans: { family: 'Frame Sans', weight: 400, file: 'inter-400.woff2', fallback: 'system-ui, sans-serif' },
  strong: { family: 'Frame Strong', weight: 600, file: 'inter-600.woff2', fallback: 'system-ui, sans-serif' },
  mono: { family: 'Frame Mono', weight: 500, file: 'ibm-plex-mono-500.woff2', fallback: 'ui-monospace, monospace' },
  edge: { family: 'Frame Edge', weight: 600, file: 'barlow-condensed-600.woff2', fallback: '"Arial Narrow", sans-serif' },
  hand: { family: 'Frame Hand', weight: 500, file: 'caveat-500.woff2', fallback: '"Segoe Print", "Bradley Hand", cursive' },
  // This face has a blank as wide as a digit at the exclamation mark, and no apostrophe,
  // which frame.js draws.
  segment: { family: 'Frame Segment', weight: 700, file: 'dseg7-classic-700.woff2', fallback: 'ui-monospace, monospace', blank: '!', tick: true },
};

const CAMERA = '{camera}';
const EXPOSURE = '{focal}  {aperture}  {shutter}  {iso}';

// A style is { pad, paper, ink, rule, round, shade, inset, turn, lines }, and may have the shapes
// { holes, chips, finder }. All of its sizes are in hundredths of the shorter side of the photo.
//   pad    The margins around the photo: top, right, bottom, left.
//   paper  The color of the margins. A style without margins has none.
//   ink    The color of the text.
//   rule   The color of a fine line on the edge of the photo. It keeps a pale photo apart
//          from pale paper, and a dark one from dark paper.
//   round  The radius of the corners of the photo.
//   shade  The color of a soft shade behind the text, for text over the photo.
//   inset  How far text over the photo is from its edges. Without it, 3.
//   turn   Whether the style lies on its side for a photo that is higher than wide, as film
//          does: its upper margin is then on the right side of the photo.
//   holes  The perforations of a film strip, { size, step, gap, round, color }: the width and
//          the height of one, the step from one to the next, and the gap to the photo.
//   chips  The main colors of the photo below it, { count, height, gap, top, rule }.
//   finder The marks of a viewfinder, { inset, arm, box, boxArm, line, color, shade }: brackets
//          in the corners of the photo, and the corners of a box at its middle.
// A line of text is { text, zone, at, align, dy, size, face, track, upper, alpha, max, lead, edit }.
//   text   The text, with tokens such as {camera}. See exif.js for the tokens.
//   zone   Where the line is: in the 'top' margin, in the 'bottom' margin, or over the photo,
//          at its lower edge ('over') or its upper edge ('head'). In a margin, the line is at
//          its middle, moved down by dy.
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
  'palette': {
    pad: [4, 4, 17, 4],
    paper: '#ffffff',
    ink: '#17191a',
    rule: DARK_RULE,
    chips: { count: 5, height: 5.5, gap: 0.8, top: 2, rule: DARK_RULE },
    lines: [
      { text: CAMERA, zone: 'bottom', at: 0, dy: 3.9, size: 2.2, face: 'strong', max: 0.48, edit: true },
      { text: EXPOSURE, zone: 'bottom', at: 1, dy: 3.9, size: 2, face: 'mono', alpha: 0.6, max: 0.48 },
    ],
  },
  'overlay-white': { pad: [0, 0, 0, 0], ink: '#ffffff', shade: 'rgba(0, 0, 0, 0.35)', lines: over },
  'overlay-black': { pad: [0, 0, 0, 0], ink: '#0c0c0c', shade: 'rgba(255, 255, 255, 0.35)', lines: over },
  // The date that a compact camera of the 1990s burned into the corner of a photo: the year
  // after an apostrophe, then the month and the day without a zero in front.
  'date-stamp': {
    pad: [0, 0, 0, 0],
    ink: '#ff9233',
    shade: 'rgba(255, 80, 0, 0.75)',
    inset: 5.5,
    lines: [
      { text: "'{yy}  {m}  {d}", zone: 'over', at: 1, size: 3.4, face: 'segment', max: 0.6, edit: true },
    ],
  },
  'viewfinder': {
    pad: [0, 0, 0, 0],
    ink: '#ffffff',
    shade: 'rgba(0, 0, 0, 0.45)',
    inset: 7,
    finder: { inset: 3.5, arm: 6, box: 13, boxArm: 3.2, line: 0.3, color: '#ffffff', shade: 'rgba(0, 0, 0, 0.45)' },
    lines: [
      { text: CAMERA, zone: 'head', at: 0, size: 2.1, face: 'mono', max: 0.6, edit: true },
      { text: '{focal}', zone: 'head', at: 1, size: 2.1, face: 'mono', max: 0.3 },
      { text: '{shutter}  {aperture}', zone: 'over', at: 0, size: 2.4, face: 'mono', max: 0.6 },
      { text: '{iso}', zone: 'over', at: 1, size: 2.4, face: 'mono', max: 0.3 },
    ],
  },
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
  // The sizes of the perforations are those of 35 mm film, on which the photo is 24 mm high.
  'film-strip': {
    pad: [22.5, 3.5, 22.5, 3.5],
    paper: '#0a0a0a',
    ink: '#f0a236',
    round: 0.7,
    turn: true,
    holes: { size: [8.2, 11.6], step: 19.8, gap: 2.9, round: 2, color: '#dddbd3' },
    lines: [
      { text: '{lens}', zone: 'top', at: 0.03, dy: -7.3, size: 2.7, face: 'edge', track: 0.1, upper: true, max: 0.5, edit: true },
      { text: CAMERA, zone: 'top', at: 0.97, align: 'right', dy: -7.3, size: 2.7, face: 'edge', track: 0.1, upper: true, max: 0.4 },
      { text: '{frame}', zone: 'bottom', at: 0.12, dy: 7.3, size: 2.7, face: 'edge', track: 0.1, lead: 'play' },
      { text: '{frame}A', zone: 'bottom', at: 0.62, dy: 7.3, size: 2.7, face: 'edge', track: 0.1, lead: 'play' },
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
