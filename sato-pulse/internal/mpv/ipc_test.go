package mpv

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func startMockServer(t *testing.T, socketPath string, handler func(net.Conn)) net.Listener {
	t.Helper()
	os.Remove(socketPath)
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatalf("mock server listen: %v", err)
	}

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go handler(conn)
		}
	}()

	return ln
}

func echoHandler(conn net.Conn) {
	defer conn.Close()
	buf := make([]byte, 4096)
	for {
		n, err := conn.Read(buf)
		if err != nil {
			return
		}
		var req ipcRequest
		if err := json.Unmarshal(buf[:n], &req); err != nil {
			continue
		}
		resp := ipcResponse{
			Data:      nil,
			Error:     "success",
			RequestID: req.RequestID,
		}
		data, _ := json.Marshal(resp)
		data = append(data, '\n')
		conn.Write(data)
	}
}

func TestIPCConnect(t *testing.T) {
	dir := t.TempDir()
	sock := filepath.Join(dir, "test.sock")

	ln := startMockServer(t, sock, echoHandler)
	defer ln.Close()

	conn, err := NewIPCConn(sock)
	if err != nil {
		t.Fatalf("connect failed: %v", err)
	}
	defer conn.Close()
}

func TestIPCCommand(t *testing.T) {
	dir := t.TempDir()
	sock := filepath.Join(dir, "test.sock")

	ln := startMockServer(t, sock, echoHandler)
	defer ln.Close()

	conn, err := NewIPCConn(sock)
	if err != nil {
		t.Fatalf("connect failed: %v", err)
	}
	defer conn.Close()

	_, err = conn.Command("set_property", "pause", true)
	if err != nil {
		t.Fatalf("command failed: %v", err)
	}
}

func TestIPCGetProperty(t *testing.T) {
	dir := t.TempDir()
	sock := filepath.Join(dir, "test.sock")

	handler := func(conn net.Conn) {
		defer conn.Close()
		buf := make([]byte, 4096)
		for {
			n, err := conn.Read(buf)
			if err != nil {
				return
			}
			var req ipcRequest
			if err := json.Unmarshal(buf[:n], &req); err != nil {
				continue
			}
			resp := ipcResponse{
				Data:      float64(75),
				Error:     "success",
				RequestID: req.RequestID,
			}
			data, _ := json.Marshal(resp)
			data = append(data, '\n')
			conn.Write(data)
		}
	}

	ln := startMockServer(t, sock, handler)
	defer ln.Close()

	conn, err := NewIPCConn(sock)
	if err != nil {
		t.Fatalf("connect failed: %v", err)
	}
	defer conn.Close()

	val, err := conn.GetProperty("volume")
	if err != nil {
		t.Fatalf("get property failed: %v", err)
	}

	vol, ok := val.(float64)
	if !ok {
		t.Fatalf("expected float64, got %T", val)
	}
	if vol != 75 {
		t.Fatalf("expected 75, got %f", vol)
	}
}

func TestIPCTimeout(t *testing.T) {
	dir := t.TempDir()
	sock := filepath.Join(dir, "test.sock")

	handler := func(conn net.Conn) {
		defer conn.Close()
		time.Sleep(5 * time.Second)
	}

	ln := startMockServer(t, sock, handler)
	defer ln.Close()

	conn, err := NewIPCConn(sock)
	if err != nil {
		t.Fatalf("connect failed: %v", err)
	}
	defer conn.Close()

	_, err = conn.Command("get_property", "volume")
	if err == nil {
		t.Fatal("expected timeout error")
	}
}

func TestIPCConnectionFailure(t *testing.T) {
	_, err := NewIPCConn("/tmp/nonexistent-sato-pulse-test.sock")
	if err == nil {
		t.Fatal("expected connection error")
	}
}
