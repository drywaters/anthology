package http

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONBody_AllowsPayloadWithinLimit(t *testing.T) {
	body := strings.NewReader(`{"name":"anthology"}`)
	req := httptest.NewRequest("POST", "/api/items", body)
	rec := httptest.NewRecorder()

	var dst map[string]string
	if err := decodeJSONBody(rec, req, &dst); err != nil {
		t.Fatalf("decodeJSONBody returned error: %v", err)
	}
	if dst["name"] != "anthology" {
		t.Fatalf("expected key to be decoded, got %v", dst)
	}
}

func TestDecodeJSONBody_RejectsPayloadExceedingLimit(t *testing.T) {
	var b strings.Builder
	b.Grow(int(maxJSONBodyBytes) + 32)
	b.WriteString(`{"data":"`)
	for i := int64(0); i < maxJSONBodyBytes; i++ {
		b.WriteByte('a')
	}
	b.WriteString(`"}`)

	req := httptest.NewRequest("POST", "/api/items", strings.NewReader(b.String()))
	rec := httptest.NewRecorder()

	var dst map[string]string
	err := decodeJSONBody(rec, req, &dst)
	if err == nil {
		t.Fatal("expected error for oversized payload")
	}
	if !strings.Contains(err.Error(), "payload too large") {
		t.Fatalf("unexpected error: %v", err)
	}
}
