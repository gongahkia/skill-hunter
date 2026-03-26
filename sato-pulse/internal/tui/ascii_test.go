package tui

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"strings"
	"testing"
)

func TestFrameToASCIIReturnsFallbackWhenMissing(t *testing.T) {
	got := frameToASCII("", 8, 4)
	if !strings.Contains(got, "Waiting for webcam frame") {
		t.Fatalf("expected waiting fallback, got %q", got)
	}
}

func TestFrameToASCIIRendersImageData(t *testing.T) {
	previewCache = asciiPreviewCache{}
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			shade := uint8((x + y) * 30)
			img.Set(x, y, color.RGBA{R: shade, G: shade, B: shade, A: 255})
		}
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}

	ascii := frameToASCII(base64.StdEncoding.EncodeToString(buf.Bytes()), 4, 4)
	lines := strings.Split(ascii, "\n")
	if len(lines) != 4 {
		t.Fatalf("expected 4 lines, got %d", len(lines))
	}
	if strings.TrimSpace(ascii) == "" {
		t.Fatal("expected visible ASCII output")
	}
}

func TestFrameToASCIICachesByFrameAndDimensions(t *testing.T) {
	previewCache = asciiPreviewCache{}

	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 0, G: 0, B: 0, A: 255})
	img.Set(1, 0, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	img.Set(0, 1, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	img.Set(1, 1, color.RGBA{R: 0, G: 0, B: 0, A: 255})

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}

	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())
	first := frameToASCII(encoded, 2, 2)
	second := frameToASCII(encoded, 2, 2)

	if first != second {
		t.Fatalf("expected cached ASCII output to be stable, got %q vs %q", first, second)
	}

	previewCache.mu.Lock()
	defer previewCache.mu.Unlock()
	if previewCache.frameBase64 != encoded || previewCache.width != 2 || previewCache.height != 2 {
		t.Fatalf(
			"expected cache populated for the rendered frame, got frame=%q width=%d height=%d",
			previewCache.frameBase64,
			previewCache.width,
			previewCache.height,
		)
	}
}
