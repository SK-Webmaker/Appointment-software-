import SwiftUI
import WebKit
import UIKit

/// The workspace itself.
///
/// One rule runs through this file: the web view is Kairo, and anything that
/// is not Kairo does not open in it. A link to another site opens in Safari,
/// where the address bar tells the owner where they are. That is what stops a
/// convincing page inside the app from being a place people type passwords.
struct KairoWebView: UIViewRepresentable {
    let url: URL
    @EnvironmentObject var session: Session

    func makeCoordinator() -> Coordinator { Coordinator(session: session, host: session.host) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "kairo")
        // Tells the page it is inside the app: the workspace hides the
        // "install Kairo on your phone" prompt and offers push instead.
        controller.addUserScript(WKUserScript(
            source: "window.kairoNative = { version: 1, platform: 'ios' };",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()          // cookies survive a relaunch

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.refreshControl = context.coordinator.makeRefresh(for: web)
        context.coordinator.web = web
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        context.coordinator.session = session
        // A notification tap or a universal link asked for a particular page.
        // Cleared on the next turn of the loop, never during this one: writing
        // to an @Published inside updateUIView is a state change during a view
        // update, which SwiftUI is right to complain about.
        if let path = session.pendingPath, path != context.coordinator.lastPath {
            context.coordinator.lastPath = path
            if let target = URL(string: path, relativeTo: url) { web.load(URLRequest(url: target)) }
            DispatchQueue.main.async { session.pendingPath = nil }
            return
        }
        // Apple handed us a device token; give it to the page, which posts it
        // with the salon's own cookie. The app never holds a credential.
        if let token = session.deviceToken, !context.coordinator.tokenSent {
            context.coordinator.tokenSent = true
            let name = Coordinator.jsString(UIDevice.current.name)
            let js = """
            (function () {
              fetch('/api/app/devices', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: '\(token)', platform: 'ios', name: \(name) })
              }).catch(function () {});
            })();
            """
            web.evaluateJavaScript(js)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var session: Session
        weak var web: WKWebView?
        var tokenSent = false
        var lastPath: String?
        private let host: String

        init(session: Session, host: String) {
            self.session = session
            self.host = host
        }

        /// A device name is whatever the owner called their phone, so it goes
        /// through JSON rather than into a quoted string by hand.
        static func jsString(_ s: String) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
                  let arr = String(data: data, encoding: .utf8) else { return "\"\"" }
            return String(arr.dropFirst().dropLast())
        }

        func makeRefresh(for web: WKWebView) -> UIRefreshControl {
            let rc = UIRefreshControl()
            rc.addAction(UIAction { [weak web] _ in web?.reload() }, for: .valueChanged)
            return rc
        }

        /// Only this salon opens in the app. Everything else goes to Safari.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = navigationAction.request.url else { decisionHandler(.cancel); return }
            if ["tel", "mailto", "sms", "facetime"].contains(target.scheme ?? "") {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            if target.host == host || target.host == nil {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        /// target="_blank" would otherwise silently do nothing.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url { UIApplication.shared.open(url) }
            return nil
        }

        /// The page talking back. Exactly one message matters: "I am signed in",
        /// which is the only honest moment to ask for notifications — asking on
        /// first launch, before they have seen anything, is how an app earns a
        /// permanent no.
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            switch type {
            case "signed-in":
                Task { @MainActor in await Push.ask() }
            case "signed-out":
                Task { @MainActor in
                    self.tokenSent = false
                    self.session.deviceToken = nil
                }
            default:
                break
            }
        }
    }
}
