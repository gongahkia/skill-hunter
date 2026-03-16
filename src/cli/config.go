package main

import "fmt"

var Priority = map[string]int{
	"FIXME": 1,
	"TODO":  2,
	"REV":   3,
	"TEMP":  4,
	"REF":   5,
}

const CustomPriority = 99

func GetPriority(tag string) int {
	if p, ok := Priority[tag]; ok {
		return p
	}
	return CustomPriority
}

type ColorScheme map[string]string // prefix -> ANSI escape

func truecolor(r, g, b int) string { // 24-bit truecolor fg
	return fmt.Sprintf("\033[38;2;%d;%d;%dm", r, g, b)
}

const Reset = "\033[0m"

var Schemes = map[string]ColorScheme{
	"gruvbox": {
		"TODO":  truecolor(250, 189, 47),
		"FIXME": truecolor(251, 73, 52),
		"TEMP":  truecolor(142, 192, 124),
		"REF":   truecolor(131, 165, 152),
		"REV":   truecolor(211, 134, 155),
	},
	"everforest": {
		"TODO":  truecolor(216, 166, 87),
		"FIXME": truecolor(230, 126, 128),
		"TEMP":  truecolor(167, 192, 128),
		"REF":   truecolor(127, 187, 179),
		"REV":   truecolor(214, 153, 182),
	},
	"tokyoNight": {
		"TODO":  truecolor(224, 175, 104),
		"FIXME": truecolor(247, 118, 142),
		"TEMP":  truecolor(158, 206, 106),
		"REF":   truecolor(122, 162, 247),
		"REV":   truecolor(187, 154, 247),
	},
	"atomDark": {
		"TODO":  truecolor(229, 192, 123),
		"FIXME": truecolor(224, 108, 117),
		"TEMP":  truecolor(152, 195, 121),
		"REF":   truecolor(97, 175, 239),
		"REV":   truecolor(198, 120, 221),
	},
	"monokai": {
		"TODO":  truecolor(244, 191, 117),
		"FIXME": truecolor(249, 38, 114),
		"TEMP":  truecolor(166, 226, 46),
		"REF":   truecolor(102, 217, 239),
		"REV":   truecolor(174, 129, 255),
	},
	"github": {
		"TODO":  truecolor(111, 66, 193),
		"FIXME": truecolor(215, 58, 73),
		"TEMP":  truecolor(40, 167, 69),
		"REF":   truecolor(3, 102, 214),
		"REV":   truecolor(0, 92, 197),
	},
	"ayu": {
		"TODO":  truecolor(255, 153, 64),
		"FIXME": truecolor(240, 113, 120),
		"TEMP":  truecolor(170, 217, 76),
		"REF":   truecolor(57, 186, 230),
		"REV":   truecolor(194, 150, 235),
	},
	"dracula": {
		"TODO":  truecolor(241, 250, 140),
		"FIXME": truecolor(255, 85, 85),
		"TEMP":  truecolor(80, 250, 123),
		"REF":   truecolor(139, 233, 253),
		"REV":   truecolor(189, 147, 249),
	},
	"rosePine": {
		"TODO":  truecolor(246, 193, 119),
		"FIXME": truecolor(235, 111, 146),
		"TEMP":  truecolor(156, 207, 216),
		"REF":   truecolor(49, 116, 143),
		"REV":   truecolor(196, 167, 231),
	},
	"spacemacs": {
		"TODO":  truecolor(220, 174, 234),
		"FIXME": truecolor(252, 92, 148),
		"TEMP":  truecolor(134, 220, 47),
		"REF":   truecolor(54, 198, 211),
		"REV":   truecolor(169, 161, 225),
	},
}

var FallbackPalette = []string{ // cycle for custom tags
	truecolor(255, 200, 100),
	truecolor(100, 200, 255),
	truecolor(200, 100, 255),
	truecolor(100, 255, 200),
	truecolor(255, 100, 200),
}

func ColorFor(scheme ColorScheme, tag string, idx int) string {
	if c, ok := scheme[tag]; ok {
		return c
	}
	return FallbackPalette[idx%len(FallbackPalette)]
}

func GetScheme(name string) ColorScheme {
	if s, ok := Schemes[name]; ok {
		return s
	}
	return Schemes["gruvbox"] // fallback
}
