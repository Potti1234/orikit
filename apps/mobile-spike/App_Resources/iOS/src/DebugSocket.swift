import Foundation

@objcMembers
public class OriKitDebugSocket: NSObject {
    private var task: URLSessionWebSocketTask?
    private var live = false
    private var onMessage: ((String) -> Void)?
    private var onError: ((String) -> Void)?
    private var onClosed: ((String) -> Void)?

    public func connectWithUrl(
        _ url: String,
        onOpen: @escaping () -> Void,
        onMessage: @escaping (String) -> Void,
        onError: @escaping (String) -> Void,
        onClosed: @escaping (String) -> Void
    ) {
        guard let target = URL(string: url) else {
            onError("Invalid debug socket url")
            onClosed("")
            return
        }
        self.onMessage = onMessage
        self.onError = onError
        self.onClosed = onClosed
        live = true

        let socket = URLSession(configuration: .default).webSocketTask(with: target)
        task = socket
        socket.resume()
        socket.sendPing { [weak self] error in
            guard let self, self.live else { return }
            DispatchQueue.main.async {
                if let error {
                    self.failWith(error.localizedDescription)
                } else {
                    onOpen()
                }
            }
        }
        receive()
    }

    public func send(_ value: String) {
        guard live, let task else { return }
        task.send(.string(value)) { [weak self] error in
            guard let self, let error, self.live else { return }
            DispatchQueue.main.async { self.failWith(error.localizedDescription) }
        }
    }

    public func close() {
        guard live else { return }
        live = false
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        let closed = onClosed
        clearHandlers()
        closed?("")
    }

    private func receive() {
        guard let task else { return }
        task.receive { [weak self] result in
            guard let self, self.live else { return }
            switch result {
            case let .success(message):
                if case let .string(value) = message {
                    DispatchQueue.main.async { self.onMessage?(value) }
                }
                self.receive()
            case let .failure(error):
                DispatchQueue.main.async { self.failWith(error.localizedDescription) }
            }
        }
    }

    private func failWith(_ message: String) {
        guard live else { return }
        live = false
        let failed = onError
        let closed = onClosed
        clearHandlers()
        failed?(message)
        closed?(message)
    }

    private func clearHandlers() {
        onMessage = nil
        onError = nil
        onClosed = nil
    }
}
