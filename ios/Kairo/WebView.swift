import SwiftUI
import WebKit
import UIKit

/// The workspace itself, and the sign-in in front of it.
///
/// One rule runs through this file: the web view is Kairo, and anything that
/// is not Kairo does not open in it. A link to another site opens in Safari,
/// where the address bar tells the owner where they are. That is what stops a
/// convincing page inside the app from being a place people type passwords.
///
/// "Kairo" here means exactly two kinds of address: the front door
/// (login.kairobookings.com), where the owner signs in with their email and
/// password, and the one salon this phone is signed in to. The front door is
/// the only thing that may hand the app to a salon, and the salon it hands
/// over to is remembered from then on.
struct KairoWebView: UIViewRepresentable {
    @EnvironmentObject var session: Session

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "kairo")
        // Tells the page it is inside the app: the workspace hides the
        // "install Kairo on your phone" prompt and offers push instead, and the
        // front door hides its links to the website. The class goes on before
        // anything is drawn, so those links never flash up and disappear.
        controller.addUserScript(WKUserScript(
            source: """
            window.kairoNative = { version: 2, platform: 'ios' };
            if (document.documentElement) document.documentElement.classList.add('kairo-app');
            """,
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

        // Something to look at while the first page is on its way, so a slow
        // connection is a spinner rather than a blank white screen.
        let spinner = UIActivityIndicatorView(style: .large)
        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false
        web.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: web.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: web.centerYAnchor),
        ])
        spinner.startAnimating()
        context.coordinator.spinner = spinner

        web.load(URLRequest(url: session.startURL))
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
            if let base = session.baseURL, let target = URL(string: path, relativeTo: base) {
                web.load(URLRequest(url: target))
            }
            DispatchQueue.main.async { session.pendingPath = nil }
            return
        }
        // Apple handed us a device token; give it to the page, which posts it
        // with the salon's own cookie. The app never holds a credential. Only
        // once the salon itself is on screen: posted from the front door it
        // would go to an address that has no salon to keep it.
        if let token = session.deviceToken, !context.coordinator.tokenSent,
           !session.host.isEmpty, web.url?.host?.lowercased() == session.host {
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
        weak var spinner: UIActivityIndicatorView?
        var tokenSent = false
        var lastPath: String?

        init(session: Session) {
            self.session = session
        }

        /// A device name is whatever the owner called their phone, so it goes
        /// through JSON rather than into a quoted string by hand.
        static func jsString(_ s: String) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
                  let arr = String(data: data, encoding: .utf8) else { return "\"\"" }
            return String(arr.dropFirst().dropLast())
        }

        // WebKit calls every delegate method below on the main thread, which
        // is where the session lives.
        private var savedHost: String {
            let s = session
            return MainActor.assumeIsolated { s.host }
        }

        private var startURL: URL {
            let s = session
            return MainActor.assumeIsolated { s.startURL }
        }

        /// Forget the salon and go back to the email-and-password page.
        private func backToSignIn(_ webView: WKWebView) {
            let s = session
            MainActor.assumeIsolated { s.signOut() }
            tokenSent = false
            DispatchQueue.main.async { webView.load(URLRequest(url: KairoAddress.frontDoor)) }
        }

        func makeRefresh(for web: WKWebView) -> UIRefreshControl {
            let rc = UIRefreshControl()
            rc.addAction(UIAction { [weak self, weak web] _ in
                guard let self, let web else { return }
                // On the "can't reach Kairo" page there is nothing to reload:
                // start again from wherever this phone should be.
                if web.url?.host == nil { web.load(URLRequest(url: self.startURL)) } else { web.reload() }
            }, for: .valueChanged)
            return rc
        }

        /// Only the front door and this phone's salon open in the app. Everything else goes to Safari.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = navigationAction.request.url else { decisionHandler(.cancel); return }
            if ["tel", "mailto", "sms", "facetime"].contains(target.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            // A frame inside the page (a card form, an "are you human" check)
            // is the page's own business. It cannot move the page anywhere, and
            // sending it to Safari would open a blank tab and break the form.
            if let frame = navigationAction.targetFrame, !frame.isMainFrame {
                decisionHandler(.allow)
                return
            }
            guard let host = target.host?.lowercased() else {
                decisionHandler(.allow)                // about:blank, the offline page
                return
            }
            let saved = savedHost
            if host == KairoAddress.loginHost || (!saved.isEmpty && host == saved) {
                decisionHandler(.allow)
                return
            }
            // The front door handing over to the salon it found. This is the
            // only way a salon that is not already this phone's opens in here.
            let fromFrontDoor = webView.url?.host?.lowercased() == KairoAddress.loginHost
            if KairoAddress.isSalonHost(host) && (saved.isEmpty || fromFrontDoor) {
                decisionHandler(.allow)
                return
            }
            UIApplication.shared.open(target)
            decisionHandler(.cancel)
        }

        /// Where the page actually ended up. A salon that answers is this
        /// phone's salon from now on; an address that names nobody is
        /// forgotten, and the owner is back at sign-in rather than stuck.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            guard navigationResponse.isForMainFrame,
                  let http = navigationResponse.response as? HTTPURLResponse,
                  let host = http.url?.host?.lowercased() else {
                decisionHandler(.allow)
                return
            }
            if http.value(forHTTPHeaderField: "X-Kairo-No-Salon") != nil {
                decisionHandler(.cancel)
                backToSignIn(webView)
                return
            }
            if KairoAddress.isSalonHost(host), (200..<300).contains(http.statusCode) {
                let s = session
                MainActor.assumeIsolated { s.adopt(host: host) }
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            spinner?.stopAnimating()
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            spinner?.stopAnimating()
            webView.scrollView.refreshControl?.endRefreshing()
            showOfflineIfUnreachable(webView, error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            spinner?.stopAnimating()
            webView.scrollView.refreshControl?.endRefreshing()
            showOfflineIfUnreachable(webView, error)
        }

        /// No connection, or Kairo did not answer: say so, with a way to try
        /// again, instead of leaving a blank screen. A navigation that was
        /// cancelled on purpose — a link sent to Safari, a page replaced by
        /// another — is not a failure and shows nothing.
        private func showOfflineIfUnreachable(_ webView: WKWebView, _ error: Error) {
            let e = error as NSError
            guard e.domain == NSURLErrorDomain, e.code != NSURLErrorCancelled else { return }
            webView.loadHTMLString(Coordinator.offlinePage, baseURL: nil)
        }

        static let offlinePage = """
        <!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 30vh 28px 0;
                 text-align: center; color: #1c2533; background: #f6f8fb; }
          @media (prefers-color-scheme: dark) { body { color: #e8eef8; background: #05070c; } }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 0 0 24px; color: #6b7a90; }
          button { font: inherit; font-weight: 600; color: #fff; background: #2f6fe0; border: 0;
                   border-radius: 12px; padding: 14px 28px; }
        </style></head><body>
        <h1>Can't reach Kairo</h1>
        <p>Check your internet connection, then try again.</p>
        <button onclick="window.webkit.messageHandlers.kairo.postMessage({ type: 'retry' })">Try again</button>
        </body></html>
        """

        /// target="_blank" would otherwise silently do nothing.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url { UIApplication.shared.open(url) }
            return nil
        }

        /// The page talking back. "I am signed in" is the only honest moment to
        /// ask for notifications — asking on first launch, before they have seen
        /// anything, is how an app earns a permanent no. "Signed out" forgets
        /// the salon, so the next person to sign in on this phone starts at the
        /// front door with their own email. "Retry" is the offline page's button.
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            switch type {
            case "signed-in":
                Task { @MainActor in await Push.ask() }
            case "signed-out":
                if let web { backToSignIn(web) }
            case "retry":
                if let web { web.load(URLRequest(url: startURL)) }
            default:
                break
            }
        }
    }
}
