package services

import "testing"

func TestDocumentTypeLabel(t *testing.T) {
	if got := documentTypeLabel(DocTypePPA); got != "Performance plan" {
		t.Fatalf("got %q", got)
	}
	if got := documentTypeLabel(DocTypeLeaveRequest); got != "Leave request" {
		t.Fatalf("got %q", got)
	}
}

func TestIsApprovedStatus(t *testing.T) {
	if !isApprovedStatus("approved") || !isApprovedStatus("Approved") {
		t.Fatal("expected approved")
	}
	if isApprovedStatus("pending") || isApprovedStatus("") {
		t.Fatal("expected not approved")
	}
}

func TestRandomTokenLength(t *testing.T) {
	tok, err := randomToken(24)
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) != 48 {
		t.Fatalf("expected 48 hex chars, got %d", len(tok))
	}
}

func TestQRDataURL(t *testing.T) {
	url, err := qrDataURL("https://example.test/verify/abc")
	if err != nil {
		t.Fatal(err)
	}
	if len(url) < 40 || url[:22] != "data:image/png;base64," {
		t.Fatalf("unexpected qr data url prefix: %s", url[:min(40, len(url))])
	}
}
