var OwlColorschemes = (function() {
  var schemes = [
    {
      id: 'gruvbox',
      name: 'Gruvbox',
      colors: {
        BACKGROUND: '#282828',
        TODO: '#FABD2F',
        FIXME: '#FB4934',
        TEMP: '#8EC07C',
        REF: '#83A598',
        REV: '#D3869B'
      }
    },
    {
      id: 'everforest',
      name: 'Everforest',
      colors: {
        BACKGROUND: '#2b3339',
        TODO: '#d8a657',
        FIXME: '#e67e80',
        TEMP: '#a7c080',
        REF: '#7fbbb3',
        REV: '#d699b6'
      }
    },
    {
      id: 'tokyo-night',
      name: 'Tokyo Night',
      colors: {
        BACKGROUND: '#1a1b26',
        TODO: '#e0af68',
        FIXME: '#f7768e',
        TEMP: '#9ece6a',
        REF: '#7aa2f7',
        REV: '#bb9af7'
      }
    },
    {
      id: 'atom-dark',
      name: 'Atom Dark',
      colors: {
        BACKGROUND: '#282c34',
        TODO: '#e5c07b',
        FIXME: '#e06c75',
        TEMP: '#98c379',
        REF: '#61afef',
        REV: '#c678dd'
      }
    },
    {
      id: 'monokai',
      name: 'Monokai',
      colors: {
        BACKGROUND: '#272822',
        TODO: '#f4bf75',
        FIXME: '#f92672',
        TEMP: '#a6e22e',
        REF: '#66d9ef',
        REV: '#ae81ff'
      }
    },
    {
      id: 'github',
      name: 'GitHub',
      colors: {
        BACKGROUND: '#ffffff',
        TODO: '#6f42c1',
        FIXME: '#d73a49',
        TEMP: '#28a745',
        REF: '#0366d6',
        REV: '#005cc5'
      }
    },
    {
      id: 'ayu',
      name: 'Ayu',
      colors: {
        BACKGROUND: '#0f1419',
        TODO: '#ff9940',
        FIXME: '#f07178',
        TEMP: '#aad94c',
        REF: '#39bae6',
        REV: '#c296eb'
      }
    },
    {
      id: 'dracula',
      name: 'Dracula',
      colors: {
        BACKGROUND: '#282a36',
        TODO: '#f1fa8c',
        FIXME: '#ff5555',
        TEMP: '#50fa7b',
        REF: '#8be9fd',
        REV: '#bd93f9'
      }
    },
    {
      id: 'rose-pine',
      name: 'Rose Pine',
      colors: {
        BACKGROUND: '#191724',
        TODO: '#f6c177',
        FIXME: '#eb6f92',
        TEMP: '#9ccfd8',
        REF: '#31748f',
        REV: '#c4a7e7'
      }
    },
    {
      id: 'spacemacs',
      name: 'Spacemacs',
      colors: {
        BACKGROUND: '#1f2022',
        TODO: '#dcaeea',
        FIXME: '#fc5c94',
        TEMP: '#86dc2f',
        REF: '#36c6d3',
        REV: '#a9a1e1'
      }
    }
  ];
  var schemeById = {};

  schemes.forEach(function(scheme) {
    schemeById[scheme.id] = scheme;
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseHex(hex) {
    var value = String(hex || '').replace('#', '');
    if (value.length === 3) {
      value = value.split('').map(function(char) {
        return char + char;
      }).join('');
    }
    var number = parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  function toHexPart(value) {
    return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  }

  function toHex(rgb) {
    return '#' + toHexPart(rgb.r) + toHexPart(rgb.g) + toHexPart(rgb.b);
  }

  function mixHex(left, right, amount) {
    var a = parseHex(left);
    var b = parseHex(right);
    var ratio = clamp(amount, 0, 1);
    return toHex({
      r: a.r + (b.r - a.r) * ratio,
      g: a.g + (b.g - a.g) * ratio,
      b: a.b + (b.b - a.b) * ratio
    });
  }

  function rgba(hex, alpha) {
    var rgb = parseHex(hex);
    return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
  }

  function luminance(hex) {
    var rgb = parseHex(hex);
    var channels = [rgb.r, rgb.g, rgb.b].map(function(value) {
      value /= 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastText(hex) {
    return luminance(hex) > 0.42 ? '#172232' : '#ffffff';
  }

  function normalizeMode(mode) {
    return mode === 'light' ? 'light' : 'dark';
  }

  function backgroundForMode(background, mode) {
    var sourceLight = luminance(background) > 0.55;
    if (mode === 'light') return sourceLight ? background : mixHex(background, '#ffffff', 0.88);
    return sourceLight ? mixHex(background, '#000000', 0.86) : background;
  }

  function cssVars(id, mode) {
    var scheme = get(id);
    var colors = scheme.colors;
    var themeMode = normalizeMode(mode);
    var bg = backgroundForMode(colors.BACKGROUND, themeMode);
    var light = themeMode === 'light';
    var ink = light ? '#172232' : '#f4f7fb';
    var surface = light ? mixHex(bg, '#eef3f7', 0.55) : mixHex(bg, '#ffffff', 0.08);
    var surfaceSoft = light ? mixHex(bg, '#e8eef5', 0.38) : mixHex(bg, '#ffffff', 0.14);
    var surfaceStrong = light ? '#ffffff' : mixHex(bg, '#ffffff', 0.18);
    var primaryStrong = mixHex(colors.REF, light ? '#000000' : '#ffffff', 0.2);

    return {
      '--bg': bg,
      '--bg-top': mixHex(bg, colors.REF, light ? 0.04 : 0.16),
      '--bg-bottom': mixHex(bg, colors.TODO, light ? 0.03 : 0.08),
      '--surface': surface,
      '--surface-soft': surfaceSoft,
      '--surface-strong': surfaceStrong,
      '--ink': ink,
      '--ink-soft': mixHex(ink, bg, light ? 0.3 : 0.24),
      '--ink-muted': mixHex(ink, bg, light ? 0.48 : 0.42),
      '--line': rgba(ink, light ? 0.16 : 0.18),
      '--line-strong': rgba(ink, light ? 0.28 : 0.32),
      '--primary': colors.REF,
      '--primary-strong': primaryStrong,
      '--secondary': colors.TODO,
      '--secondary-strong': mixHex(colors.TODO, light ? '#000000' : '#ffffff', 0.18),
      '--success': colors.TEMP,
      '--success-strong': mixHex(colors.TEMP, light ? '#000000' : '#ffffff', 0.18),
      '--danger': colors.FIXME,
      '--error': colors.FIXME,
      '--error-strong': mixHex(colors.FIXME, light ? '#000000' : '#ffffff', 0.18),
      '--revision': colors.REV,
      '--tag-todo': colors.TODO,
      '--tag-fixme': colors.FIXME,
      '--tag-temp': colors.TEMP,
      '--tag-ref': colors.REF,
      '--tag-rev': colors.REV,
      '--tag-followup': colors.REV,
      '--tag-unresolved': colors.FIXME,
      '--tag-prompt': colors.TEMP,
      '--on-primary': contrastText(colors.REF),
      '--on-secondary': contrastText(colors.TODO),
      '--on-success': contrastText(colors.TEMP),
      '--on-danger': contrastText(colors.FIXME),
      '--on-error': contrastText(colors.FIXME),
      '--shadow': light ? rgba('#102033', 0.12) : rgba('#000000', 0.34),
      '--soft-shadow': light ? rgba('#102033', 0.07) : rgba('#000000', 0.22),
      '--wash-primary': rgba(colors.REF, light ? 0.12 : 0.24),
      '--wash-secondary': rgba(colors.TODO, light ? 0.12 : 0.24)
    };
  }

  function get(id) {
    return schemeById[id] || schemeById.gruvbox;
  }

  function all() {
    return schemes.slice();
  }

  function apply(rootDocument, id, mode) {
    var target = rootDocument || document;
    var style = target.documentElement.style;
    var themeMode = normalizeMode(mode);
    var vars = cssVars(id, themeMode);
    Object.keys(vars).forEach(function(key) {
      style.setProperty(key, vars[key]);
    });
    target.documentElement.dataset.colorscheme = get(id).id;
    target.documentElement.dataset.themeMode = themeMode;
    return get(id);
  }

  return {
    all: all,
    get: get,
    cssVars: cssVars,
    apply: apply,
    defaultId: 'gruvbox'
  };
})();

if (typeof module !== 'undefined') module.exports = OwlColorschemes;
