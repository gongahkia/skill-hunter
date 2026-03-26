package tui

import (
	"bytes"
	"encoding/base64"
	"image"
	_ "image/jpeg"
	"strings"
	"sync"
)

var asciiRamp = []rune("@%#*+=-:. ")

type asciiPreviewCache struct {
	mu          sync.Mutex
	frameBase64 string
	width       int
	height      int
	ascii       string
}

var previewCache asciiPreviewCache

func frameToASCII(frameBase64 string, width, height int) string {
	if frameBase64 == "" {
		return "  Waiting for webcam frame"
	}

	previewCache.mu.Lock()
	if previewCache.frameBase64 == frameBase64 &&
		previewCache.width == width &&
		previewCache.height == height {
		ascii := previewCache.ascii
		previewCache.mu.Unlock()
		return ascii
	}
	previewCache.mu.Unlock()

	data, err := base64.StdEncoding.DecodeString(frameBase64)
	if err != nil {
		return "  Webcam frame unavailable"
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "  Webcam frame unavailable"
	}

	bounds := img.Bounds()
	if bounds.Dx() == 0 || bounds.Dy() == 0 {
		return "  Webcam frame unavailable"
	}

	var lines []string
	for y := 0; y < height; y++ {
		sampleY := bounds.Min.Y + (y*bounds.Dy())/height
		var line strings.Builder
		for x := 0; x < width; x++ {
			sampleX := bounds.Min.X + (x*bounds.Dx())/width
			r, g, b, _ := img.At(sampleX, sampleY).RGBA()
			luminance := (299*float64(r) + 587*float64(g) + 114*float64(b)) / 1000.0
			normalized := luminance / 65535.0
			idx := int(normalized * float64(len(asciiRamp)-1))
			if idx < 0 {
				idx = 0
			}
			if idx >= len(asciiRamp) {
				idx = len(asciiRamp) - 1
			}
			line.WriteRune(asciiRamp[idx])
		}
		lines = append(lines, line.String())
	}

	ascii := strings.Join(lines, "\n")

	previewCache.mu.Lock()
	previewCache.frameBase64 = frameBase64
	previewCache.width = width
	previewCache.height = height
	previewCache.ascii = ascii
	previewCache.mu.Unlock()

	return ascii
}
