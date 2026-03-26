package mpv

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const ipcTimeout = 2 * time.Second

type ipcRequest struct {
	Command   []any `json:"command"`
	RequestID int64 `json:"request_id"`
}

type ipcResponse struct {
	Data      any    `json:"data"`
	Error     string `json:"error"`
	RequestID int64  `json:"request_id"`
}

type IPCConn struct {
	conn    net.Conn
	scanner *bufio.Scanner
	mu      sync.Mutex
	nextID  atomic.Int64
	pending map[int64]chan ipcResponse
	pmu     sync.Mutex
}

func NewIPCConn(socketPath string) (*IPCConn, error) {
	conn, err := net.DialTimeout("unix", socketPath, ipcTimeout)
	if err != nil {
		return nil, fmt.Errorf("mpv ipc connect: %w", err)
	}

	ic := &IPCConn{
		conn:    conn,
		scanner: bufio.NewScanner(conn),
		pending: make(map[int64]chan ipcResponse),
	}

	go ic.readLoop()

	return ic, nil
}

func (ic *IPCConn) readLoop() {
	for ic.scanner.Scan() {
		line := ic.scanner.Bytes()
		var resp ipcResponse
		if err := json.Unmarshal(line, &resp); err != nil {
			continue
		}

		if resp.RequestID > 0 {
			ic.pmu.Lock()
			ch, ok := ic.pending[resp.RequestID]
			if ok {
				delete(ic.pending, resp.RequestID)
			}
			ic.pmu.Unlock()

			if ok {
				ch <- resp
			}
		}
	}
}

func (ic *IPCConn) send(req ipcRequest) (ipcResponse, error) {
	ch := make(chan ipcResponse, 1)

	ic.pmu.Lock()
	ic.pending[req.RequestID] = ch
	ic.pmu.Unlock()

	data, err := json.Marshal(req)
	if err != nil {
		return ipcResponse{}, err
	}
	data = append(data, '\n')

	ic.mu.Lock()
	ic.conn.SetWriteDeadline(time.Now().Add(ipcTimeout))
	_, err = ic.conn.Write(data)
	ic.mu.Unlock()

	if err != nil {
		ic.pmu.Lock()
		delete(ic.pending, req.RequestID)
		ic.pmu.Unlock()
		return ipcResponse{}, fmt.Errorf("mpv ipc write: %w", err)
	}

	select {
	case resp := <-ch:
		if resp.Error != "" && resp.Error != "success" {
			return resp, fmt.Errorf("mpv: %s", resp.Error)
		}
		return resp, nil
	case <-time.After(ipcTimeout):
		ic.pmu.Lock()
		delete(ic.pending, req.RequestID)
		ic.pmu.Unlock()
		return ipcResponse{}, ErrTimeout
	}
}

func (ic *IPCConn) Command(args ...any) (any, error) {
	id := ic.nextID.Add(1)
	req := ipcRequest{
		Command:   args,
		RequestID: id,
	}
	resp, err := ic.send(req)
	if err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func (ic *IPCConn) GetProperty(name string) (any, error) {
	return ic.Command("get_property", name)
}

func (ic *IPCConn) SetProperty(name string, value any) error {
	_, err := ic.Command("set_property", name, value)
	return err
}

func (ic *IPCConn) Close() error {
	if ic.conn != nil {
		return ic.conn.Close()
	}
	return nil
}
