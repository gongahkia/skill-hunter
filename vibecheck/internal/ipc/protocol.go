package ipc

import "encoding/json"

const ProtocolVersion = 1

// Message types
const (
	TypeHealthCheck    = "health_check"
	TypeHealthResult   = "health_result"
	TypeCaptureRequest = "capture_request"
	TypeEmotionResult  = "emotion_result"
	TypeSearchRequest  = "search_request"
	TypeSearchResult   = "search_result"
	TypeShutdown       = "shutdown"
	TypeShutdownAck    = "shutdown_ack"
	TypeError          = "error"
)

type Message struct {
	Version int    `json:"version"`
	Type    string `json:"type"`
	ID      string `json:"id"`
}

type RuntimeConfig struct {
	CameraIndex         int     `json:"camera_index"`
	Resolution          string  `json:"resolution"`
	ModelBackend        string  `json:"model_backend"`
	SmoothingWindow     int     `json:"smoothing_window"`
	ConfidenceThreshold float64 `json:"confidence_threshold"`
}

type HealthCheck struct {
	Message
	Config RuntimeConfig `json:"config"`
}

type CameraInfo struct {
	Available  bool   `json:"available"`
	Resolution [2]int `json:"resolution"`
	FPS        int    `json:"fps"`
	Backend    string `json:"backend"`
	Error      string `json:"error"`
}

type YTMusicInfo struct {
	Authenticated bool `json:"authenticated"`
}

type HealthResult struct {
	Message
	Status         string      `json:"status"`
	Camera         CameraInfo  `json:"camera"`
	YTMusic        YTMusicInfo `json:"ytmusic"`
	EmotionBackend string      `json:"emotion_backend"`
}

type CaptureRequest struct {
	Message
	Config RuntimeConfig `json:"config"`
}

type EmotionResult struct {
	Message
	FaceDetected   bool               `json:"face_detected"`
	Emotions       map[string]float64 `json:"emotions"`
	Mood           *string            `json:"mood"`
	MoodConfidence float64            `json:"mood_confidence"`
	MoodChanged    bool               `json:"mood_changed"`
	PreviousMood   *string            `json:"previous_mood"`
	FrameBase64    string             `json:"frame_base64"`
}

type SearchRequest struct {
	Message
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type Track struct {
	VideoID         string `json:"video_id"`
	Title           string `json:"title"`
	Artist          string `json:"artist"`
	Album           string `json:"album"`
	DurationSeconds int    `json:"duration_seconds"`
	ThumbnailURL    string `json:"thumbnail_url"`
	PlaybackURL     string `json:"playback_url"`
	SearchQuery     string `json:"search_query,omitempty"`
}

type SearchResult struct {
	Message
	Tracks []Track `json:"tracks"`
}

type Shutdown struct {
	Message
}

type ShutdownAck struct {
	Message
}

type ErrorMsg struct {
	Message
	ErrorType    string `json:"error_type"`
	ErrorMessage string `json:"message"`
}

func NewMessage(msgType, id string) Message {
	return Message{
		Version: ProtocolVersion,
		Type:    msgType,
		ID:      id,
	}
}

func Encode(v any) ([]byte, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	data = append(data, '\n')
	return data, nil
}

func Decode(data []byte) (Message, error) {
	var msg Message
	err := json.Unmarshal(data, &msg)
	return msg, err
}
