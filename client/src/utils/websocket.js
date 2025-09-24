// WebSocket utility for CEMS
class CEMSWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.options = options;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.isConnecting = false;
        this.isConnected = false;
        this.messageHandlers = new Set();
        this.errorHandlers = new Set();
        this.connectHandlers = new Set();
        this.disconnectHandlers = new Set();
    }

    connect() {
        if (this.isConnecting || this.isConnected) {
            console.log("WebSocket already connecting or connected, skipping...");
            return;
        }

        this.isConnecting = true;
        console.log(`Connecting to WebSocket: ${this.url}`);

        try {
            this.ws = new WebSocket(this.url);
            this.setupEventHandlers();
        } catch (error) {
            console.error("Failed to create WebSocket:", error);
            this.handleError(error);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log("WebSocket connected");
            this.isConnecting = false;
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.connectHandlers.forEach(handler => handler());
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.messageHandlers.forEach(handler => handler(data));
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        this.ws.onclose = (event) => {
            console.log("WebSocket disconnected:", event.code, event.reason);
            this.isConnecting = false;
            this.isConnected = false;
            this.disconnectHandlers.forEach(handler => handler(event));
            
            if (!event.wasClean) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            this.errorHandlers.forEach(handler => handler(error));
        };
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log("Max reconnection attempts reached");
            return;
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    send(data) {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
                console.log("WebSocket message sent:", data);
            } catch (error) {
                console.error("Error sending WebSocket message:", error);
            }
        } else {
            console.warn("WebSocket not ready for sending. State:", {
                isConnected: this.isConnected,
                wsExists: !!this.ws,
                readyState: this.ws ? this.ws.readyState : 'no ws'
            });
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, "Client disconnect");
            this.ws = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
    }

    // Event handlers
    onMessage(handler) {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onError(handler) {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    onConnect(handler) {
        this.connectHandlers.add(handler);
        return () => this.connectHandlers.delete(handler);
    }

    onDisconnect(handler) {
        this.disconnectHandlers.add(handler);
        return () => this.disconnectHandlers.delete(handler);
    }

    handleError(error) {
        this.errorHandlers.forEach(handler => handler(error));
    }
}

export default CEMSWebSocket;
