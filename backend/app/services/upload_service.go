package services

import (
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"goravel/app/facades"
)

const maxAttachmentBytes = 5 * 1024 * 1024

var allowedAttachmentMIME = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"image/gif":       ".gif",
	"application/pdf": ".pdf",
}

type UploadedFile struct {
	URL      string `json:"url"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
	Size     int    `json:"size"`
}

type UploadService struct{}

func NewUploadService() *UploadService {
	return &UploadService{}
}

func (s *UploadService) StoreDataURL(dataURL, originalName string) (UploadedFile, error) {
	if strings.TrimSpace(dataURL) == "" {
		return UploadedFile{}, fmt.Errorf("file payload is required")
	}
	if strings.HasPrefix(dataURL, "http://") || strings.HasPrefix(dataURL, "https://") || strings.HasPrefix(dataURL, "/api/") {
		name := originalName
		if name == "" {
			name = "attachment"
		}
		return UploadedFile{URL: dataURL, Name: name, MimeType: "application/octet-stream"}, nil
	}

	mime, payload, err := parseDataURL(dataURL)
	if err != nil {
		return UploadedFile{}, err
	}
	ext, ok := allowedAttachmentMIME[mime]
	if !ok {
		return UploadedFile{}, fmt.Errorf("unsupported file type: %s (allowed: images and PDF)", mime)
	}
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return UploadedFile{}, fmt.Errorf("invalid file encoding")
	}
	if len(raw) > maxAttachmentBytes {
		return UploadedFile{}, fmt.Errorf("file is too large (max %d MB)", maxAttachmentBytes/(1024*1024))
	}

	name := sanitizeFilename(originalName)
	if name == "" {
		name = "attachment" + ext
	} else if filepath.Ext(name) == "" {
		name += ext
	}

	filename := fmt.Sprintf("%s-%d%s", uuid.NewString(), time.Now().Unix(), ext)
	relativePath := "uploads/" + filename
	if err := facades.Storage().Disk("public").Put(relativePath, string(raw)); err != nil {
		return UploadedFile{}, err
	}

	return UploadedFile{
		URL:      "/api/v1/files?path=" + relativePath,
		Name:     name,
		MimeType: mime,
		Size:     len(raw),
	}, nil
}

func (s *UploadService) ReadPublic(relativePath string) ([]byte, string, error) {
	clean := strings.TrimPrefix(strings.TrimSpace(relativePath), "/")
	clean = strings.TrimPrefix(clean, "api/v1/files/")
	if clean == "" || strings.Contains(clean, "..") {
		return nil, "", fmt.Errorf("invalid file path")
	}
	if !strings.HasPrefix(clean, "uploads/") {
		return nil, "", fmt.Errorf("invalid file path")
	}
	if !facades.Storage().Disk("public").Exists(clean) {
		return nil, "", fmt.Errorf("file not found")
	}
	content, err := facades.Storage().Disk("public").Get(clean)
	if err != nil {
		return nil, "", err
	}
	mime := mimeFromExt(filepath.Ext(clean))
	return []byte(content), mime, nil
}

func parseDataURL(dataURL string) (mime string, payload string, err error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", "", fmt.Errorf("file must be a data URL")
	}
	headerAndData := strings.SplitN(dataURL, ",", 2)
	if len(headerAndData) != 2 {
		return "", "", fmt.Errorf("invalid file data")
	}
	header := headerAndData[0]
	payload = headerAndData[1]
	if !strings.HasSuffix(header, ";base64") {
		return "", "", fmt.Errorf("only base64-encoded files are supported")
	}
	mime = strings.TrimPrefix(header, "data:")
	mime = strings.TrimSuffix(mime, ";base64")
	if mime == "" {
		return "", "", fmt.Errorf("missing file mime type")
	}
	return mime, payload, nil
}

func sanitizeFilename(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "..", "")
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	return name
}

func mimeFromExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}
